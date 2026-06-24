// ============================================================================
// pipeline.mjs — the generation pipeline CLI
// ----------------------------------------------------------------------------
// One command turns a topic + light config into a LIVE, playable session:
//
//   node infra/pipeline/pipeline.mjs make "<topic>" --slides N --questions M [--session id]
//
// Block order: by default the model lays out slides-then-questions. To pin the
// EXACT order, pass --sequence with comma tokens (s=slide, q=question, or a
// specific format mc|tf|fb). Counts are derived from it. Example:
//
//   node infra/pipeline/pipeline.mjs make "<topic>" --sequence q,s,q,s,s
//
// Stages (each idempotent where it can be; retry-once/fail-loud throughout):
//   AUTHOR   — Gemini structured draft (text only)            [author.mjs]
//   (assign) — normalize draft → stable ids; derive media jobs[assemble.mjs]
//   MEDIA    — Gemini TTS voice (wav) + Nano Banana image    [media.mjs]
//   PUBLISH  — S3 upload + assemble + validate + DynamoDB     [publish.mjs]
//
// Status lifecycle (so the future teacher gallery can poll):
//   processing → (on success) ready  |  (on any failure) failed
// ============================================================================
import { readEnv } from "./gemini.mjs";
import { authorDraft } from "./author.mjs";
import { normalizeDraft, deriveJobs, slugify } from "./assemble.mjs";
import { runMedia, OUT_ROOT } from "./media.mjs";
import { publish, putStatus } from "./publish.mjs";
import { withRetry, step, ok, log, warn, info } from "./util.mjs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Map one --sequence token to a block spec. Case-insensitive. Tokens:
//   s | slide            → a slide
//   q | question         → a question (the model picks the best format)
//   mc | multiple-choice → multiple-choice question
//   tf | true-false      → true/false question
//   fb | fill-blank      → fill-in-the-blank question
const SEQUENCE_TOKENS = {
  s: { type: "slide" },
  slide: { type: "slide" },
  q: { type: "question" },
  question: { type: "question" },
  mc: { type: "question", format: "multiple-choice" },
  "multiple-choice": { type: "question", format: "multiple-choice" },
  tf: { type: "question", format: "true-false" },
  "true-false": { type: "question", format: "true-false" },
  fb: { type: "question", format: "fill-blank" },
  "fill-blank": { type: "question", format: "fill-blank" },
};

export function parseSequence(raw) {
  if (!raw) return null;
  const seq = raw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .map((t) => {
      const spec = SEQUENCE_TOKENS[t];
      if (!spec) throw new Error(`--sequence: unknown token "${t}" (use s, q, mc, tf, fb)`);
      return spec;
    });
  if (seq.length === 0) throw new Error("--sequence: provide at least one block, e.g. q,s,q,s,s");
  return seq;
}

export function parseArgs(argv) {
  const a = argv.slice(2);
  const cmd = a[0];
  const flags = { slides: 1, questions: 3, session: null, sequence: null };
  const positional = [];
  for (let i = 1; i < a.length; i++) {
    const t = a[i];
    if (t === "--slides") flags.slides = Number(a[++i]);
    else if (t === "--questions") flags.questions = Number(a[++i]);
    else if (t === "--session") flags.session = a[++i];
    else if (t === "--sequence") flags.sequence = a[++i];
    else positional.push(t);
  }
  return { cmd, topic: positional.join(" ").trim(), flags };
}

async function make({ topic, slides, questions, sequence = null, session }) {
  if (!topic) throw new Error('topic required — e.g. make "the water cycle" --slides 1 --questions 3');

  // An explicit --sequence wins: derive the slide/question counts from it so all
  // the downstream count-based plumbing keeps working unchanged.
  if (sequence) {
    slides = sequence.filter((s) => s.type === "slide").length;
    questions = sequence.filter((s) => s.type === "question").length;
  } else {
    if (!Number.isInteger(slides) || slides < 0) throw new Error("--slides must be a non-negative integer");
    if (!Number.isInteger(questions) || questions < 1) throw new Error("--questions must be a positive integer");
  }

  const geminiKey = await readEnv("GEMINI_API_KEY");

  // Deterministic id up front so we can mark "processing" before any slow work.
  const sessionId = session || slugify(topic);

  const shape = sequence
    ? sequence.map((s) => (s.type === "slide" ? "s" : s.format ? s.format : "q")).join(",")
    : `${slides} slide / ${questions} questions`;
  log(`\n\x1b[1m🌱 tuwon pipeline\x1b[0m — "${topic}"  (${shape})  → session "${sessionId}"`);

  // Mark processing immediately (upserts a {sessionId, status} record).
  await putStatus(sessionId, "processing").catch(() => warn("could not write processing status (continuing)"));

  try {
    // ── AUTHOR (cached per session: Gemini is non-deterministic, so we author
    //    once and reuse the draft so re-runs stay consistent with cached media) ──
    const draftPath = resolve(OUT_ROOT, sessionId, "draft.json");
    let ndraft;
    if (existsSync(draftPath)) {
      step("author: using cached draft");
      ndraft = JSON.parse(await readFile(draftPath, "utf8"));
    } else {
      step("author: Gemini structured draft");
      const draft = await withRetry(
        () => authorDraft({ topic, slides, questions, sequence, apiKey: geminiKey }),
        "author"
      );
      ndraft = normalizeDraft(draft, { sessionId });
      await mkdir(resolve(OUT_ROOT, sessionId), { recursive: true });
      await writeFile(draftPath, JSON.stringify(ndraft, null, 2));
    }
    const jobs = deriveJobs(ndraft);
    ok(`"${ndraft.title}" — ${ndraft.blocks.map((b) => (b.type === "slide" ? "slide" : b.format)).join(" → ")}`);
    ok(`icon: ${ndraft.icon} · jobs: ${Object.keys(jobs.audioJobs).length} audio · ${Object.keys(jobs.imageJobs).length} image`);

    // ── MEDIA ──
    await runMedia(ndraft, jobs, { geminiKey });

    // ── PUBLISH ──
    const payload = await publish(ndraft);

    log(`\n\x1b[32m✅ LIVE\x1b[0m — "${payload.title}" is published and ready.`);
    log(`   session code: \x1b[1m${sessionId}\x1b[0m  (${payload.blocks.length} blocks)`);
    log(`   Scan/enter this code in the Android app → Download → play offline.\n`);
    return payload;
  } catch (e) {
    await putStatus(sessionId, "failed").catch(() => {});
    throw e;
  }
}

async function main() {
  const { cmd, topic, flags } = parseArgs(process.argv);
  if (cmd !== "make") {
    console.error(
      'usage: node infra/pipeline/pipeline.mjs make "<topic>" [--slides N --questions M | --sequence s,q,s,...] [--session id]'
    );
    process.exit(2);
  }
  const sequence = parseSequence(flags.sequence);
  await make({ topic, slides: flags.slides, questions: flags.questions, sequence, session: flags.session });
}

// Only run the CLI when invoked directly (so tests can import the helpers).
// The teacher app spawns this file as argv[1], so that path still runs main().
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((e) => {
    console.error(`\n\x1b[31m✗ ${e.message}\x1b[0m`);
    process.exit(1);
  });
}
