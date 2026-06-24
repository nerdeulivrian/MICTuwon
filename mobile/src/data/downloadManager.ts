// ============================================================================
// DOWNLOAD MANAGER  (real on-disk download)
// ----------------------------------------------------------------------------
// "Download a session for offline use" — for real now. It fetches the payload
// and every asset it references to device storage, then the session opens and
// plays with the radio off. The pieces:
//   1. load the payload (live API or mock),
//   2. enumerate every UNIQUE asset URL it references,
//   3. download each to the session's on-disk assets/ dir (with progress),
//   4. write the payload JSON + the remoteUrl→filename map to disk,
//   5. mark the session downloaded (the Library shelf) and rehydrate the
//      resolver so its remote URLs now resolve to the local files.
//
// The on-disk layout and all file I/O live in `offline.ts`; this module is the
// orchestration + progress. Persistence is ATOMIC-ish: assets download into a
// freshly-wiped dir, and only after every byte lands do we commit the payload,
// map, and shelf entry. A failure mid-download wipes the partial dir and leaves
// the session un-downloaded (so the Intro CTA stays DOWNLOAD — retryable).
// ============================================================================
import { loadPayload, summarize } from "./loader";
import { markDownloaded, unmarkDownloaded, downloadedSessionIds } from "./downloads";
import {
  prepareSessionDir,
  downloadAsset,
  savePayload,
  saveAssetMap,
  deleteSessionFiles,
  rehydrateResolver,
  type AssetMap,
} from "./offline";
import type { AssetUrl, Payload } from "../types/payload";
import { isSlide, isMultipleChoice, isFillBlank } from "../types/payload";

/** Every asset URL a payload references, de-duplicated, in walk order. */
export function collectAssetUrls(payload: Payload): AssetUrl[] {
  const urls: AssetUrl[] = [];
  const add = (u: AssetUrl | undefined) => {
    if (u && !urls.includes(u)) urls.push(u);
  };

  add(payload.sharedAssets.trueAudio);
  add(payload.sharedAssets.falseAudio);

  for (const block of payload.blocks) {
    if (isSlide(block)) {
      add(block.image);
      add(block.narration.audio);
      continue;
    }
    // Question blocks
    add(block.promptAudio);
    add(block.explanations.correct.audio);
    add(block.explanations.incorrect.audio);
    if (isMultipleChoice(block)) {
      for (const o of block.options) add(o.audio);
    } else if (isFillBlank(block)) {
      for (const c of block.chips) add(c.audio);
    }
    // true-false uses the shared clips already added above
  }
  return urls;
}

/** Only http(s) URLs are real files to fetch (every payload asset is a remote
 *  https URL; a non-http reference, if any, has no bytes to download). */
function isDownloadable(url: AssetUrl): boolean {
  return /^https?:\/\//i.test(url);
}

/** Stable on-disk filename for the i-th asset, keeping the URL's extension when
 *  it has a real one (so the player picks the right decoder); index keeps names
 *  unique and short. picsum-style extensionless URLs just get `aN`. */
function assetFileName(url: AssetUrl, index: number): string {
  const path = url.split(/[?#]/)[0];
  const last = path.slice(path.lastIndexOf("/") + 1);
  const dot = last.lastIndexOf(".");
  const ext =
    dot > 0 && /^\.[a-z0-9]{1,5}$/i.test(last.slice(dot)) ? last.slice(dot).toLowerCase() : "";
  return `a${index}${ext}`;
}

export interface DownloadProgress {
  /** 0 → 1, fraction of assets processed. */
  fraction: number;
  done: number;
  total: number;
}

/**
 * Download a session for offline use. Resolves once the payload and every asset
 * are on disk and the session is on the shelf. `onProgress` fires as each asset
 * finishes so the caller can animate a bar.
 */
export async function downloadSession(
  sessionId: string,
  onProgress?: (p: DownloadProgress) => void
): Promise<void> {
  const payload = await loadPayload(sessionId);
  const urls = collectAssetUrls(payload).filter(isDownloadable);
  const total = urls.length;

  onProgress?.({ fraction: 0, done: 0, total });

  try {
    // Start clean: wipe any partial/previous copy, recreate the assets dir.
    prepareSessionDir(sessionId);

    // Fetch every asset to the session's assets/ dir, building remoteUrl→filename.
    const map: AssetMap = {};
    for (let i = 0; i < total; i++) {
      const remoteUrl = urls[i];
      const name = assetFileName(remoteUrl, i);
      await downloadAsset(sessionId, remoteUrl, name);
      map[remoteUrl] = name;
      onProgress?.({ fraction: (i + 1) / total, done: i + 1, total });
    }
    if (total === 0) onProgress?.({ fraction: 1, done: 0, total: 0 });

    // Commit: payload + map to disk, then the shelf entry. Order matters — only
    // mark downloaded once the bytes are all there.
    savePayload(sessionId, payload);
    saveAssetMap(sessionId, map);
    markDownloaded(summarize(payload));

    // Point the resolver at the local files for THIS session (and re-assert
    // every other downloaded session's overrides).
    rehydrateResolver(downloadedSessionIds());
  } catch (e) {
    // Roll back the partial dir so a retry starts clean and the session stays
    // un-downloaded (the Intro CTA falls back to DOWNLOAD). The error propagates
    // to the caller (Intro) to surface to the user.
    deleteSessionFiles(sessionId);
    throw e;
  }
}

/** Remove a downloaded session: delete its files + take it off the shelf, then
 *  rebuild the resolver from the sessions that remain. */
export async function deleteSession(sessionId: string): Promise<void> {
  deleteSessionFiles(sessionId);
  unmarkDownloaded(sessionId);
  rehydrateResolver(downloadedSessionIds());
}
