// ============================================================================
// gemini.mjs — minimal Gemini REST client (no SDK, just fetch)
// ----------------------------------------------------------------------------
// Three calls the pipeline needs, matching the official docs (ai.google.dev),
// kept dependency-light:
//
//   generateJSON   — structured output (Author stage). Uses
//       generationConfig.responseMimeType + responseSchema (stable raw-REST).
//     model: gemini-3.1-flash-lite · endpoint: v1beta · returns parsed object.
//
//   generateImage  — Nano Banana Pro (Gemini 3 Pro Image, slide images). Uses
//       generateContent with responseModalities ["TEXT","IMAGE"]; the image
//       comes back as an inlineData part (base64). It's a THINKING model: it may
//       emit interim "thought" images, so we take the final NON-thought image.
//     model: gemini-3-pro-image · endpoint: v1beta · returns { buffer, mimeType }.
//
//   generateSpeech — native Gemini text-to-speech (replaces ElevenLabs). Uses
//       generateContent with responseModalities ["AUDIO"] + a speechConfig voice;
//       the audio comes back as an inlineData part of raw PCM (base64, 24kHz/16-bit
//       mono). We wrap that PCM in a WAV container and return the .wav Buffer.
//     model: gemini-3.1-flash-tts-preview · endpoint: v1beta · returns a WAV Buffer.
//
// Secrets come from infra/.env (GEMINI_API_KEY) — never hard-coded, never logged.
// ============================================================================
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(HERE, "..", ".env"); // infra/.env

const TEXT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const IMAGE_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export const MODELS = {
  author: "gemini-3.1-flash-lite",
  image: "gemini-3-pro-image", // Nano Banana Pro
  tts: "gemini-3.1-flash-tts-preview", // native Gemini text-to-speech
};

// Default narration voice (one of the 30 prebuilt Gemini TTS voices). "Sulafat"
// is a warm, friendly read that suits a tutor; swap freely (see the voice list
// in the speech-generation docs). The chosen name is also stored on the payload
// as config.voice.
export const DEFAULT_VOICE = "Sulafat";

/** Read a single KEY from infra/.env (no deps; ignores quotes/whitespace). */
export async function readEnv(name) {
  if (!existsSync(ENV_PATH)) throw new Error(`infra/.env not found at ${ENV_PATH}`);
  const text = await readFile(ENV_PATH, "utf8");
  const m = text.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+?)\\s*$`, "m"));
  if (!m || !m[1]) throw new Error(`${name} missing/empty in infra/.env`);
  return m[1].replace(/^["']|["']$/g, "");
}

/**
 * Structured-output text generation. Returns the parsed JSON object that
 * conforms to `schema`.
 */
export async function generateJSON({ prompt, schema, apiKey, model = MODELS.author }) {
  const res = await fetch(`${TEXT_BASE}/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        // Stable raw-REST structured-output form (v1beta). The newer
        // responseFormat.text.{mimeType,schema} shape from the docs rejects
        // "application/json" as a mimeType enum over raw REST, so we use the
        // long-supported responseMimeType + responseSchema pair instead.
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini ${model} ${res.status} ${res.statusText} — ${detail.slice(0, 400)}`);
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  // Join all non-thought text parts; structured output is raw JSON (no fences),
  // but strip a ```json fence defensively just in case.
  const raw = parts
    .filter((p) => p?.text && !p.thought)
    .map((p) => p.text)
    .join("")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  if (!raw) {
    const fr = data?.candidates?.[0]?.finishReason;
    throw new Error(`Gemini ${model} returned no JSON text (finishReason: ${fr ?? "n/a"})`);
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`Gemini ${model} JSON parse failed: ${e.message}\n--- raw ---\n${raw.slice(0, 800)}`);
  }
}

/**
 * Image generation via Nano Banana Pro (Gemini 3 Pro Image). Returns
 * { buffer, mimeType }.
 *
 * Uses the Gemini generateContent API with responseModalities ["TEXT","IMAGE"];
 * the image comes back as an inlineData part (base64). Gemini 3 image models are
 * THINKING models: they may emit up to two interim "thought" images
 * (part.thought===true) before the final one — we take the final NON-thought
 * image. The size/aspect config moved between `responseFormat.image` and
 * `imageConfig` shapes across API revisions, so we try the documented shapes in
 * order and only fall through on a 400 (a config-shape rejection).
 */
export async function generateImage({
  prompt,
  apiKey,
  model = MODELS.image,
  aspectRatio = "16:9",
  imageSize = "2K",
}) {
  const configs = [
    { responseModalities: ["TEXT", "IMAGE"], responseFormat: { image: { aspectRatio, imageSize } } },
    { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio, imageSize } },
    { responseModalities: ["TEXT", "IMAGE"], responseFormat: { image: { aspectRatio } } },
    { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio } },
    { responseModalities: ["TEXT", "IMAGE"] },
  ];
  let lastErr;
  for (const generationConfig of configs) {
    try {
      return await imageCall({ model, prompt, apiKey, generationConfig });
    } catch (e) {
      lastErr = e;
      // Only fall through on a 400 (a config-shape rejection); anything else
      // (auth, quota, network) is a real failure — stop and surface it.
      if (!/\b400\b/.test(e.message)) throw e;
    }
  }
  throw lastErr;
}

async function imageCall({ model, prompt, apiKey, generationConfig }) {
  const res = await fetch(`${IMAGE_BASE}/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini image ${model} ${res.status} ${res.statusText} — ${detail.slice(0, 400)}`);
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  // Prefer the final NON-thought image; fall back to the last image of any kind.
  const images = parts.filter((p) => p?.inlineData?.data);
  const finalImg = [...images].reverse().find((p) => !p.thought) ?? images[images.length - 1];
  if (!finalImg) {
    const fr = data?.candidates?.[0]?.finishReason;
    throw new Error(`Gemini image ${model} returned no image (finishReason: ${fr ?? "n/a"})`);
  }
  return {
    buffer: Buffer.from(finalImg.inlineData.data, "base64"),
    mimeType: finalImg.inlineData.mimeType || "image/png",
  };
}

/**
 * Wrap raw little-endian PCM samples in a minimal WAV (RIFF) container so the
 * bytes are a self-describing, playable .wav file. Gemini TTS returns 16-bit
 * mono PCM at 24kHz by default; the mimeType carries the real rate.
 */
export function pcmToWav(pcm, { sampleRate = 24000, channels = 1, bitsPerSample = 16 } = {}) {
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm.length;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // PCM fmt chunk size
  header.writeUInt16LE(1, 20); // audio format 1 = PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcm]);
}

/** Pull the sample rate out of a PCM mimeType like "audio/L16;codec=pcm;rate=24000". */
function rateFromMime(mimeType) {
  const m = /rate=(\d+)/.exec(mimeType || "");
  return m ? Number(m[1]) : 24000;
}

/**
 * Synthesize `text` → WAV Buffer via native Gemini text-to-speech. Returns the
 * bytes of a ready-to-write .wav file (PCM wrapped in a RIFF header).
 *
 * Uses generateContent with responseModalities ["AUDIO"] and a single-speaker
 * speechConfig (prebuilt voice by name). The audio is an inlineData part of raw
 * base64 PCM; we read its rate from the mimeType and wrap it as WAV. The TTS
 * model occasionally returns a text token instead of audio (documented), which
 * surfaces here as "no audio" — the caller's retry-once handles that.
 */
export async function generateSpeech({ text, voice = DEFAULT_VOICE, apiKey, model = MODELS.tts }) {
  if (!text || !text.trim()) throw new Error("generateSpeech: text is required");
  const res = await fetch(`${TEXT_BASE}/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
        },
      },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini TTS ${model} ${res.status} ${res.statusText} — ${detail.slice(0, 400)}`);
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const audio = parts.find((p) => p?.inlineData?.data);
  if (!audio) {
    const fr = data?.candidates?.[0]?.finishReason;
    throw new Error(`Gemini TTS ${model} returned no audio (finishReason: ${fr ?? "n/a"})`);
  }
  const pcm = Buffer.from(audio.inlineData.data, "base64");
  return pcmToWav(pcm, { sampleRate: rateFromMime(audio.inlineData.mimeType) });
}
