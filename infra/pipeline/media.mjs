// ============================================================================
// media.mjs — the MEDIA stage (audio + slide images)
// ----------------------------------------------------------------------------
// Given a normalized draft + derived jobs, produce every asset to a local
// per-session out dir. Phased + idempotent (skips files already on disk so a
// re-run never re-spends credits), with retry-once/fail-loud per asset.
//
//   audio  — Gemini TTS for every audioJobs[key]  → out/<id>/audio/<key>.wav
//   image  — Nano Banana Pro for every imageJobs[key] → out/<id>/image/<key>.png
//
// Layout mirrors what publish.mjs uploads to S3 (sessions/<id>/{audio,image}).
// (Word-by-word karaoke alignment was removed with the move to Gemini TTS — the
// app now shows a static transcript, so no per-word timing is generated.)
// ============================================================================
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateSpeech, generateImage } from "./gemini.mjs";
import { withRetry, step, ok, info } from "./util.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const OUT_ROOT = resolve(HERE, "out");

export const paths = {
  audioDir: (id) => resolve(OUT_ROOT, id, "audio"),
  imageDir: (id) => resolve(OUT_ROOT, id, "image"),
  audioFile: (id, key) => resolve(OUT_ROOT, id, "audio", `${key}.wav`),
  imageFile: (id, key) => resolve(OUT_ROOT, id, "image", `${key}.png`),
};

/**
 * Run the full media stage for a normalized draft.
 * @param ndraft  normalized draft (has sessionId + config.voice)
 * @param jobs    { audioJobs, imageJobs } from deriveJobs
 * @param keys    { geminiKey }
 */
export async function runMedia(ndraft, jobs, keys) {
  const id = ndraft.sessionId;
  const voice = ndraft.config.voice;
  await mkdir(paths.audioDir(id), { recursive: true });
  await mkdir(paths.imageDir(id), { recursive: true });

  // ── audio (Gemini TTS) ───────────────────────────────────────────────────
  step(`media: audio (${Object.keys(jobs.audioJobs).length} clips, Gemini TTS → wav)`);
  for (const [key, text] of Object.entries(jobs.audioJobs)) {
    const out = paths.audioFile(id, key);
    if (existsSync(out)) { info(`skip ${key} (cached)`); continue; }
    const buf = await withRetry(() => generateSpeech({ text, voice, apiKey: keys.geminiKey }), `tts ${key}`);
    await writeFile(out, buf);
    ok(`${key}.wav (${(buf.length / 1024).toFixed(1)} KB)`);
  }

  // ── images (Nano Banana Pro) ─────────────────────────────────────────────
  step(`media: images (${Object.keys(jobs.imageJobs).length} slide, Nano Banana Pro 16:9)`);
  for (const [key, prompt] of Object.entries(jobs.imageJobs)) {
    const out = paths.imageFile(id, key);
    if (existsSync(out)) { info(`skip ${key} (cached)`); continue; }
    const { buffer } = await withRetry(
      () => generateImage({ prompt, apiKey: keys.geminiKey, aspectRatio: "16:9", imageSize: "2K" }),
      `image ${key}`
    );
    await writeFile(out, buffer);
    ok(`${key}.png (${(buffer.length / 1024).toFixed(1)} KB)`);
  }
}
