// ============================================================================
// test-author.mjs — exercise the Author stage alone (cheap; text only).
// ----------------------------------------------------------------------------
// Calls Gemini structured output for a topic, then runs the draft through the
// deterministic spine (normalize → deriveJobs) to prove the whole text path is
// wired. No media (TTS/image) spend. Prints the draft + derived job counts.
//
// Run:  node infra/pipeline/test-author.mjs "the water cycle" 1 3
// ============================================================================
import { readEnv } from "./gemini.mjs";
import { authorDraft } from "./author.mjs";
import { normalizeDraft, deriveJobs } from "./assemble.mjs";

const topic = process.argv[2] || "the water cycle";
const slides = Number(process.argv[3] ?? 1);
const questions = Number(process.argv[4] ?? 3);

const apiKey = await readEnv("GEMINI_API_KEY");
console.log(`\n▶ author — "${topic}" (${slides} slide / ${questions} questions)`);
const draft = await authorDraft({ topic, slides, questions, apiKey });

console.log("\n--- raw draft ---");
console.log(JSON.stringify(draft, null, 2));

const ndraft = normalizeDraft(draft, { sessionId: "test-author" });
const jobs = deriveJobs(ndraft);
console.log("\n--- normalized summary ---");
console.log(`title:   ${ndraft.title}`);
console.log(`icon:    ${ndraft.icon}`);
console.log(`summary: ${ndraft.summary}`);
console.log(`blocks:  ${ndraft.blocks.map((b) => (b.type === "slide" ? "slide" : b.format)).join(" → ")}`);
console.log(`jobs:    ${Object.keys(jobs.audioJobs).length} audio · ${Object.keys(jobs.imageJobs).length} image`);
console.log("\nDone.");
