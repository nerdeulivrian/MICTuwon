// ============================================================================
// ASSET RESOLVER
// ----------------------------------------------------------------------------
// The single layer the player uses to turn a stored asset reference (from the
// payload) into a concrete URI for <Image>, audio, or fetch().
//
// - Online: the reference is already a full https URL → passthrough.
// - Offline: when a session is downloaded, its remote URLs are registered
//   against local file:// paths (by offline.rehydrateResolver, from what the
//   download manager wrote to disk); this layer transparently returns the local
//   path instead. The payload format never changes — only what this resolver
//   hands back. So every screen calls resolveAsset() and stays identical whether
//   the session is streamed or fully offline.
// ============================================================================
import type { AssetUrl } from "../types/payload";

export type AssetSource = { uri: string };

/**
 * Remote URL → local file:// path, populated from disk by offline.rehydrateResolver
 * for every downloaded session (on launch, after a download, after a delete).
 * Empty when nothing is downloaded — the pure online path.
 */
const localOverrides = new Map<string, string>();

/** Map a remote asset URL to its local file:// path (one downloaded asset). */
export function registerLocalAsset(remoteUrl: AssetUrl, localPath: string): void {
  localOverrides.set(remoteUrl, localPath);
}

/** Drop all overrides; rehydrateResolver clears before re-registering from disk. */
export function clearLocalAssets(): void {
  localOverrides.clear();
}

/** Resolve a stored reference to the URI that should actually be loaded. */
export function resolveUri(ref: AssetUrl): string {
  return localOverrides.get(ref) ?? ref;
}

/** Source object for RN <Image> / expo-av. */
export function resolveAsset(ref: AssetUrl): AssetSource {
  return { uri: resolveUri(ref) };
}

/** True when this reference is being served from a local (downloaded) file. */
export function isLocal(ref: AssetUrl): boolean {
  return localOverrides.has(ref);
}
