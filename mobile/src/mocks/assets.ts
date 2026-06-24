// ============================================================================
// PLACEHOLDER ASSETS (mock only)
// ----------------------------------------------------------------------------
// Central helpers so every mock payload references media the same way. In a
// real payload these are full S3/CDN URLs baked in by the pipeline; here we
// point at free placeholder services so the player has something to render
// with zero backend.
//
// Everything flows through the asset resolver, so a downloaded session reads
// these from local files instead — nothing else changes.
// ============================================================================
import type { AssetUrl } from "../types/payload";

/** 16:9 placeholder slide image, seeded so each slide is stable + distinct. */
export function mockImage(seed: string, width = 1280): AssetUrl {
  const height = Math.round((width * 9) / 16);
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}`;
}

/**
 * Placeholder audio. Real payloads carry per-line TTS; for mocks we point every
 * audio field at a single short, reliable sample clip. Playback is best-effort
 * in the mock — the UI must not depend on it succeeding.
 *
 * Host matters for REAL offline download: the native downloader does strict TLS
 * chain validation, so the clip must have a currently-valid cert. This small
 * (~28KB) mp3 on a valid-cert host downloads cleanly.
 */
export function mockAudio(_seed: string): AssetUrl {
  return "https://www.w3schools.com/html/horse.mp3";
}

/** Shared true/false option clips (one backend constant in real life). */
export const mockSharedAssets = {
  trueAudio: mockAudio("shared-true"),
  falseAudio: mockAudio("shared-false"),
};
