// ============================================================================
// selftest.mjs — offline verification of the assembler spine (no API keys).
// ----------------------------------------------------------------------------
// Proves the generic draft → jobs → payload path is correct by running a draft
// that exercises a slide + all three question formats through:
//   normalizeDraft → deriveJobs → assemble → validatePayload
// and asserting the wiring (ids, option letters, chip↔blank, job↔URL keys).
//
// Run:  node infra/pipeline/selftest.mjs   (exit 0 = pass, 1 = fail)
// ============================================================================
import assert from "node:assert/strict";
import { normalizeDraft, deriveJobs, assemble, validatePayload } from "./assemble.mjs";

const sampleDraft = {
  title: "How Rainbows Form",
  summary: "Discover how sunlight and raindrops paint a rainbow across the sky.",
  icon: "rainbow",
  estimatedMinutes: 4,
  blocks: [
    {
      type: "slide",
      title: "How Rainbows Form",
      narrationText:
        "A rainbow appears when sunlight shines through tiny raindrops floating in the air.",
      imagePrompt:
        "A vibrant classroom-style slide showing sunlight passing through a raindrop and splitting into a rainbow, labeled diagram, soft colors, 16:9.",
    },
    {
      type: "question",
      format: "multiple-choice",
      prompt: "What happens to sunlight when it enters a raindrop?",
      options: ["It bends and splits into colors", "It disappears completely", "It turns into rain"],
      correctIndex: 0,
      explanationCorrect: "Exactly! The raindrop bends the light and separates it into colors.",
      explanationIncorrect: "Not quite — the raindrop bends the light and splits it into colors.",
    },
    {
      type: "question",
      format: "true-false",
      prompt: "A rainbow always appears in the part of the sky opposite the sun.",
      correctAnswer: true,
      explanationCorrect: "Right! The sun is behind you and the rain is in front of you.",
      explanationIncorrect: "Actually it's true — the sun is behind you and the rain is in front.",
    },
    {
      type: "question",
      format: "fill-blank",
      prompt: "Complete the sentence:",
      template: "When light bends as it enters a raindrop, this is called {{blank}}.",
      answer: "refraction",
      distractors: ["reflection", "evaporation"],
      explanationCorrect: "Yes! Refraction is the bending of light as it passes into the water.",
      explanationIncorrect: "The bending of light entering the drop is called refraction.",
    },
  ],
};

let failures = 0;
const check = (name, fn) => {
  try {
    fn();
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (e) {
    failures++;
    console.log(`  \x1b[31m✗ ${name}\x1b[0m\n      ${e.message}`);
  }
};

console.log("\n▶ assemble spine selftest");

const ndraft = normalizeDraft(sampleDraft, { sessionId: "rainbows-test" });

check("normalize assigns stable ids", () => {
  assert.equal(ndraft.sessionId, "rainbows-test");
  assert.equal(ndraft.createdBy, "Mr. Mic"); // no-auth default
  assert.equal(ndraft.blocks[0].id, "slide-1");
  assert.equal(ndraft.blocks[1].id, "q-1");
  assert.equal(ndraft.blocks[1].options.map((o) => o.id).join(""), "abc");
  assert.equal(ndraft.blocks[1].correctOptionId, "a");
  assert.equal(ndraft.blocks[3].template.includes("{{b1}}"), true);
  assert.equal(ndraft.blocks[3].blanks[0].correctChipId, "c1");
  assert.equal(ndraft.blocks[3].chips[0].text, "refraction");
});

const jobs = deriveJobs(ndraft);

check("deriveJobs covers every clip + the slide image", () => {
  // 2 shared + slide narration + (q1: prompt+3 opts+2 expl) + (q2: prompt+2 expl) + (q3: prompt+3 chips+2 expl)
  const expectedAudio = 2 + 1 + (1 + 3 + 2) + (1 + 2) + (1 + 3 + 2);
  assert.equal(Object.keys(jobs.audioJobs).length, expectedAudio);
  assert.equal(Object.keys(jobs.imageJobs).length, 1);
  assert.ok(jobs.audioJobs["shared.true"] && jobs.audioJobs["shared.false"]);
  assert.ok(jobs.imageJobs["slide-1"].length > 10);
});

// Fake URL resolvers — pretend every job key got uploaded to S3.
const base = "https://tuwon-assets-sg-174508893991.s3.ap-southeast-1.amazonaws.com/sessions/rainbows-test";
const audioUrl = (k) => `${base}/audio/${k}.wav`;
const imageUrl = (k) => `${base}/image/${k}.png`;

const payload = assemble(ndraft, { audioUrl, imageUrl });

check("assemble produces a valid payload (all https, no holes)", () => {
  validatePayload(payload);
});

check("every derived audio job is referenced by the payload (no orphans/holes)", () => {
  const referenced = new Set();
  const walk = (u) => referenced.add(u);
  walk(payload.sharedAssets.trueAudio);
  walk(payload.sharedAssets.falseAudio);
  for (const b of payload.blocks) {
    if (b.type === "slide") {
      walk(b.narration.audio);
    } else {
      walk(b.promptAudio);
      walk(b.explanations.correct.audio);
      walk(b.explanations.incorrect.audio);
      if (b.format === "multiple-choice") b.options.forEach((o) => walk(o.audio));
      if (b.format === "fill-blank") b.chips.forEach((c) => walk(c.audio));
    }
  }
  // Each audio job key must map to a referenced URL, and counts must match.
  const jobUrls = Object.keys(jobs.audioJobs).map((k) => audioUrl(k));
  for (const u of jobUrls) assert.ok(referenced.has(u), `job url not referenced: ${u}`);
  assert.equal(referenced.size, jobUrls.length, "payload references a URL with no backing job");
});

check("icon + createdBy carried onto the payload", () => {
  assert.equal(payload.icon, "rainbow");
  assert.equal(payload.createdBy, "Mr. Mic");
});

check("fill-blank chip audio wired to the blank's correct chip", () => {
  const fb = payload.blocks.find((b) => b.format === "fill-blank");
  const correctChip = fb.chips.find((c) => c.id === fb.blanks[0].correctChipId);
  assert.equal(correctChip.text, "refraction");
  assert.ok(correctChip.audio.startsWith("https://"));
});

console.log(failures === 0 ? "\n\x1b[32mAll spine checks passed.\x1b[0m\n" : `\n\x1b[31m${failures} check(s) failed.\x1b[0m\n`);
process.exit(failures === 0 ? 0 : 1);
