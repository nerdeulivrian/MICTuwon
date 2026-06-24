// ============================================================================
// OFFLINE SESSION STORE  (real on-disk persistence)
// ----------------------------------------------------------------------------
// Turns "downloaded" from a label into the real thing: the payload JSON and
// every asset it references live on the device, so a downloaded session opens
// and plays with the radio off. The download manager writes here; the loader
// reads the payload from here; the resolver is rehydrated from here.
//
// LAYOUT under Paths.document (which survives relaunch — expo-file-system v56):
//   sessions/<id>/payload.json   the full payload — the offline source of truth
//   sessions/<id>/assets/<name>  one downloaded file per UNIQUE asset URL
//   sessions/<id>/assets.json    { remoteUrl: "<name>" } — the resolver's map
//
// Two deliberate choices:
//   • PER-SESSION dirs, not a shared pool. Deleting a session is `rm -rf` of its
//     dir with zero chance of clobbering an asset another session still needs
//     (our placeholder mocks all point at the same sample mp3). The cost is a
//     duplicate copy of a shared URL; real per-session TTS never overlaps anyway.
//   • assets.json stores the FILENAME, not an absolute file:// uri. The app
//     sandbox path can change between launches/installs (iOS container UUID), so
//     we rebuild the absolute uri from Paths.document at read time instead of
//     trusting a stored one.
// ============================================================================
import { Directory, File, Paths } from "expo-file-system";
import type { Payload } from "../types/payload";
import { registerLocalAsset, clearLocalAssets } from "../assets/resolver";

const ROOT = "sessions";

// ── Path helpers (every file/dir lives under Paths.document/sessions/<id>) ────
function sessionDir(sessionId: string): Directory {
  return new Directory(Paths.document, ROOT, sessionId);
}
function assetsDir(sessionId: string): Directory {
  return new Directory(Paths.document, ROOT, sessionId, "assets");
}
function payloadFile(sessionId: string): File {
  return new File(Paths.document, ROOT, sessionId, "payload.json");
}
function assetMapFile(sessionId: string): File {
  return new File(Paths.document, ROOT, sessionId, "assets.json");
}
function assetFile(sessionId: string, name: string): File {
  return new File(Paths.document, ROOT, sessionId, "assets", name);
}

/** remoteUrl → filename within the session's assets/ dir. */
export type AssetMap = Record<string, string>;

/**
 * Current absolute file:// uri for a stored asset. Rebuilt from Paths.document
 * each call so it's correct even if the sandbox path moved since download.
 */
export function assetUri(sessionId: string, name: string): string {
  return assetFile(sessionId, name).uri;
}

/**
 * Start a session's dir tree from scratch: wipe any partial/previous copy so a
 * re-download begins clean, then (re)create the assets/ dir (and its parents).
 */
export function prepareSessionDir(sessionId: string): void {
  const dir = sessionDir(sessionId);
  if (dir.exists) dir.delete();
  assetsDir(sessionId).create({ intermediates: true, idempotent: true });
}

/** Download one asset into the session's assets/ dir under `name` (overwrite-safe). */
export async function downloadAsset(
  sessionId: string,
  remoteUrl: string,
  name: string
): Promise<void> {
  const dest = assetFile(sessionId, name);
  if (dest.exists) dest.delete(); // downloadFileAsync writes a fresh file
  await File.downloadFileAsync(remoteUrl, dest);
}

/** Write the payload JSON for offline reading. */
export function savePayload(sessionId: string, payload: Payload): void {
  const file = payloadFile(sessionId);
  file.create({ overwrite: true });
  file.write(JSON.stringify(payload));
}

/** Read the offline payload, or null if this session isn't downloaded / unreadable. */
export function readPayload(sessionId: string): Payload | null {
  try {
    const file = payloadFile(sessionId);
    if (!file.exists) return null;
    return JSON.parse(file.textSync()) as Payload;
  } catch (e) {
    console.warn("offline: failed to read payload", sessionId, e);
    return null;
  }
}

/** Persist the remoteUrl → filename map so the resolver can be rehydrated. */
export function saveAssetMap(sessionId: string, map: AssetMap): void {
  const file = assetMapFile(sessionId);
  file.create({ overwrite: true });
  file.write(JSON.stringify(map));
}

function readAssetMap(sessionId: string): AssetMap | null {
  try {
    const file = assetMapFile(sessionId);
    if (!file.exists) return null;
    return JSON.parse(file.textSync()) as AssetMap;
  } catch (e) {
    console.warn("offline: failed to read asset map", sessionId, e);
    return null;
  }
}

/** Delete everything stored for a session (payload + assets + map). Best-effort. */
export function deleteSessionFiles(sessionId: string): void {
  try {
    const dir = sessionDir(sessionId);
    if (dir.exists) dir.delete();
  } catch (e) {
    console.warn("offline: failed to delete session files", sessionId, e);
  }
}

/**
 * Rebuild the in-memory resolver map from what's on disk for the given sessions.
 * Disk is the source of truth — clear, then register every stored asset's remote
 * URL against its current local uri. Called on launch, after a download, and
 * after a delete, so a remote URL always resolves to a surviving local copy (or
 * falls back to the network once no downloaded session references it).
 */
export function rehydrateResolver(sessionIds: readonly string[]): void {
  clearLocalAssets();
  for (const id of sessionIds) {
    const map = readAssetMap(id);
    if (!map) continue;
    for (const remoteUrl in map) {
      registerLocalAsset(remoteUrl, assetUri(id, map[remoteUrl]));
    }
  }
}
