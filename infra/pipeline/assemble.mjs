// ============================================================================
// assemble.mjs — the deterministic spine of the generation pipeline
// ----------------------------------------------------------------------------
// Turns a TEXT-ONLY *draft* (what the Gemini "Author" stage emits) into:
//   1. the media JOBS the Media stage must produce (audio / image),
//   2. a valid PLAYER PAYLOAD once those assets have public URLs.
//
// This generalizes the hand-authored prototype: there the `audioJobs` map and
// `assemble()` were written by hand for one session; here they are DERIVED from
// any draft. The draft is intentionally
// loose/pedagogical (what an LLM is good at); all the fiddly contract details
// (stable ids, option letters, chip wiring, key→filename scheme) are assigned
// deterministically HERE so the Author never has to get them right.
//
// Nothing in this file calls a network/API — it's pure data transformation, so
// it's verifiable offline (see selftest.mjs).
//
// ── DRAFT SHAPE (Author output; text only) ─────────────────────────────────
//   {
//     title:    string,            // session title
//     summary:  string,            // one-line intro description
//     icon:     string,            // a lucide glyph name (see ICON_ENUM)
//     estimatedMinutes?: number,   // optional; falls back to a block-count est.
//     blocks: [
//       { type:"slide",
//         title: string,
//         narrationText: string,   // the spoken teaching line
//         imagePrompt: string },   // prompt for Nano Banana Pro (16:9 slide)
//
//       { type:"question", format:"multiple-choice",
//         prompt: string,
//         options: string[],       // 2–4 option texts
//         correctIndex: number,    // index into options
//         explanationCorrect: string,
//         explanationIncorrect: string },
//
//       { type:"question", format:"true-false",
//         prompt: string,
//         correctAnswer: boolean,
//         explanationCorrect: string,
//         explanationIncorrect: string },
//
//       { type:"question", format:"fill-blank",
//         prompt: string,
//         template: string,        // sentence containing exactly one {{blank}}
//         answer: string,          // correct chip text
//         distractors: string[],   // 1–3 wrong chip texts
//         explanationCorrect: string,
//         explanationIncorrect: string },
//     ]
//   }
// ============================================================================

// Lucide glyph names the Author may choose from for the session icon. Kept as a
// curated allow-list so the mobile app can map name→component without bundling
// every icon, and so structured-output can constrain it to a safe enum.
export const ICON_ENUM = [
  "droplets", "sprout", "globe", "flask-conical", "atom", "calculator",
  "book-open", "leaf", "sun", "cloud", "rainbow", "zap", "rocket", "brain",
  "heart", "music", "palette", "landmark", "map", "microscope", "dna",
  "telescope", "mountain", "flame", "snowflake", "wind", "star", "lightbulb",
];

const DEFAULTS = {
  createdBy: "Mr. Mic", // no-auth MVP: the teacher is hardcoded
  voice: "Sulafat", // a prebuilt Gemini TTS voice (warm); also stored on the payload
  language: "en-US",
  icon: "lightbulb",
};

// ── id / key scheme (single source of truth for both jobs + assemble) ────────
const letter = (i) => String.fromCharCode(97 + i); // 0->a, 1->b, ...
const keys = {
  slideNarration: (n) => `slide-${n}.narration`,
  slideImage: (n) => `slide-${n}`,
  qPrompt: (qid) => `${qid}.prompt`,
  qCorrect: (qid) => `${qid}.correct`,
  qIncorrect: (qid) => `${qid}.incorrect`,
  mcOption: (qid, optId) => `${qid}.opt-${optId}`,
  fbChip: (qid, chipId) => `${qid}.chip-${chipId}`,
  trueAudio: "shared.true",
  falseAudio: "shared.false",
};

const slugify = (s) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "session";

/**
 * Assign every stable id the contract needs and fold in deterministic metadata
 * (sessionId, createdBy, config). Returns a NEW normalized draft; the Author's
 * loose output is never mutated. Throws on structural problems (fail loud).
 */
export function normalizeDraft(draft, opts = {}) {
  if (!draft || !Array.isArray(draft.blocks) || draft.blocks.length === 0) {
    throw new Error("normalizeDraft: draft.blocks must be a non-empty array");
  }
  const cfg = {
    sessionId: opts.sessionId || slugify(draft.sessionId || draft.title || "session"),
    createdBy: opts.createdBy || draft.createdBy || DEFAULTS.createdBy,
    voice: opts.voice || DEFAULTS.voice,
    language: opts.language || DEFAULTS.language,
  };

  let slideN = 0;
  let qN = 0;
  const blocks = draft.blocks.map((b) => {
    if (b.type === "slide") {
      slideN += 1;
      if (!b.narrationText || !b.imagePrompt) {
        throw new Error(`normalizeDraft: slide ${slideN} missing narrationText/imagePrompt`);
      }
      return {
        type: "slide",
        id: `slide-${slideN}`,
        n: slideN,
        title: b.title || draft.title || `Slide ${slideN}`,
        narrationText: b.narrationText.trim(),
        imagePrompt: b.imagePrompt.trim(),
      };
    }
    if (b.type === "question") {
      qN += 1;
      const id = `q-${qN}`;
      const common = {
        type: "question",
        id,
        format: b.format,
        prompt: must(b.prompt, `${id}.prompt`),
        explanationCorrect: must(b.explanationCorrect, `${id}.explanationCorrect`),
        explanationIncorrect: must(b.explanationIncorrect, `${id}.explanationIncorrect`),
      };
      if (b.format === "multiple-choice") {
        const options = (b.options || []).map((t, i) => ({ id: letter(i), text: String(t).trim() }));
        if (options.length < 2) throw new Error(`${id}: multiple-choice needs >= 2 options`);
        const ci = Number.isInteger(b.correctIndex) ? b.correctIndex : 0;
        if (ci < 0 || ci >= options.length) throw new Error(`${id}: correctIndex out of range`);
        return { ...common, options, correctOptionId: options[ci].id };
      }
      if (b.format === "true-false") {
        if (typeof b.correctAnswer !== "boolean") throw new Error(`${id}: true-false needs boolean correctAnswer`);
        return { ...common, correctAnswer: b.correctAnswer };
      }
      if (b.format === "fill-blank") {
        const answer = must(b.answer, `${id}.answer`).trim();
        const distractors = (b.distractors || []).map((d) => String(d).trim()).filter(Boolean);
        if (distractors.length < 1) throw new Error(`${id}: fill-blank needs >= 1 distractor`);
        // Normalize the single blank token to the contract's {{b1}} form.
        const template = String(must(b.template, `${id}.template`))
          .replace(/\{\{\s*(blank|b1|1)\s*\}\}/i, "{{b1}}")
          .trim();
        if (!template.includes("{{b1}}")) throw new Error(`${id}: fill-blank template needs one {{blank}} token`);
        // chips = correct answer first, then distractors; stable ids c1..cK.
        const chipTexts = [answer, ...distractors];
        const chips = chipTexts.map((t, i) => ({ id: `c${i + 1}`, text: t }));
        return {
          ...common,
          template,
          blanks: [{ id: "b1", correctChipId: chips[0].id }],
          chips,
        };
      }
      throw new Error(`${id}: unknown question format "${b.format}"`);
    }
    throw new Error(`normalizeDraft: unknown block type "${b.type}"`);
  });

  if (slideN + qN === 0) throw new Error("normalizeDraft: draft produced no blocks");

  return {
    sessionId: cfg.sessionId,
    title: must(draft.title, "title"),
    createdBy: cfg.createdBy,
    estimatedMinutes:
      Number.isFinite(draft.estimatedMinutes) && draft.estimatedMinutes > 0
        ? Math.round(draft.estimatedMinutes)
        : Math.max(2, Math.round((slideN * 0.6 + qN * 0.5))),
    summary: must(draft.summary, "summary"),
    icon: ICON_ENUM.includes(draft.icon) ? draft.icon : DEFAULTS.icon,
    config: { voice: cfg.voice, language: cfg.language },
    blocks,
  };
}

function must(v, where) {
  if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) {
    throw new Error(`missing required field: ${where}`);
  }
  return v;
}

/**
 * Derive the media jobs from a NORMALIZED draft. Returns:
 *   audioJobs:  { key -> text }   every spoken clip (Gemini TTS)
 *   imageJobs:  { key -> prompt } slide images (Nano Banana Pro)
 * The keys match exactly what assemble() looks up, so media + assembly agree.
 */
export function deriveJobs(ndraft) {
  const audioJobs = {};
  const imageJobs = {};

  // Shared true/false clips (one backend constant in production; generated here).
  audioJobs[keys.trueAudio] = "True.";
  audioJobs[keys.falseAudio] = "False.";

  let usesTrueFalse = false;

  for (const b of ndraft.blocks) {
    if (b.type === "slide") {
      audioJobs[keys.slideNarration(b.n)] = b.narrationText;
      imageJobs[keys.slideImage(b.n)] = b.imagePrompt;
      continue;
    }
    // question
    audioJobs[keys.qPrompt(b.id)] = b.prompt;
    audioJobs[keys.qCorrect(b.id)] = b.explanationCorrect;
    audioJobs[keys.qIncorrect(b.id)] = b.explanationIncorrect;
    if (b.format === "multiple-choice") {
      for (const o of b.options) audioJobs[keys.mcOption(b.id, o.id)] = o.text;
    } else if (b.format === "fill-blank") {
      for (const c of b.chips) audioJobs[keys.fbChip(b.id, c.id)] = c.text;
    } else if (b.format === "true-false") {
      usesTrueFalse = true;
    }
  }

  // If no true/false question uses them, the shared clips are still cheap to
  // generate and keep sharedAssets valid — leave them in.
  void usesTrueFalse;

  return { audioJobs, imageJobs };
}

/**
 * Stitch resolved asset URLs into the final player Payload.
 * @param {object} ndraft   a normalized draft (from normalizeDraft)
 * @param {object} urls
 * @param {(key:string)=>string} urls.audioUrl  audio key  -> public wav URL
 * @param {(key:string)=>string} urls.imageUrl  image key  -> public image URL
 */
export function assemble(ndraft, { audioUrl, imageUrl }) {
  const blocks = ndraft.blocks.map((b) => {
    if (b.type === "slide") {
      return {
        type: "slide",
        id: b.id,
        title: b.title,
        image: imageUrl(keys.slideImage(b.n)),
        narration: {
          text: b.narrationText,
          audio: audioUrl(keys.slideNarration(b.n)),
        },
      };
    }
    const explanations = {
      correct: { text: b.explanationCorrect, audio: audioUrl(keys.qCorrect(b.id)) },
      incorrect: { text: b.explanationIncorrect, audio: audioUrl(keys.qIncorrect(b.id)) },
    };
    if (b.format === "multiple-choice") {
      return {
        type: "question",
        id: b.id,
        format: "multiple-choice",
        prompt: b.prompt,
        promptAudio: audioUrl(keys.qPrompt(b.id)),
        options: b.options.map((o) => ({ id: o.id, text: o.text, audio: audioUrl(keys.mcOption(b.id, o.id)) })),
        correctOptionId: b.correctOptionId,
        explanations,
      };
    }
    if (b.format === "true-false") {
      return {
        type: "question",
        id: b.id,
        format: "true-false",
        prompt: b.prompt,
        promptAudio: audioUrl(keys.qPrompt(b.id)),
        correctAnswer: b.correctAnswer,
        explanations,
      };
    }
    // fill-blank
    return {
      type: "question",
      id: b.id,
      format: "fill-blank",
      prompt: b.prompt,
      promptAudio: audioUrl(keys.qPrompt(b.id)),
      template: b.template,
      blanks: b.blanks,
      chips: b.chips.map((c) => ({ id: c.id, text: c.text, audio: audioUrl(keys.fbChip(b.id, c.id)) })),
      explanations,
    };
  });

  return {
    sessionId: ndraft.sessionId,
    title: ndraft.title,
    createdBy: ndraft.createdBy,
    estimatedMinutes: ndraft.estimatedMinutes,
    summary: ndraft.summary,
    icon: ndraft.icon, // NEW contract field (Author-chosen lucide glyph)
    config: { voice: ndraft.config.voice, language: ndraft.config.language },
    sharedAssets: {
      trueAudio: audioUrl(keys.trueAudio),
      falseAudio: audioUrl(keys.falseAudio),
    },
    blocks,
  };
}

/**
 * Validate an assembled payload: shape + every asset reference an absolute
 * https URL (no holes, no functions-passed-as-values — a real bug this caught
 * before). Throws with every problem listed. Mirrors generate.mjs's validator
 * but generalized for any number/mix of blocks.
 */
export function validatePayload(p) {
  const bad = [];
  const isHttps = (u) => typeof u === "string" && /^https:\/\//.test(u);
  const check = (u, where) => { if (!isHttps(u)) bad.push(`${where}: ${JSON.stringify(u)}`); };

  for (const f of ["sessionId", "title", "createdBy", "summary", "icon"]) {
    if (!p[f] || typeof p[f] !== "string") bad.push(`top-level ${f} missing/not-string`);
  }
  if (!p.config?.voice || !p.config?.language) bad.push("config.voice/language missing");
  check(p.sharedAssets?.trueAudio, "sharedAssets.trueAudio");
  check(p.sharedAssets?.falseAudio, "sharedAssets.falseAudio");
  if (!Array.isArray(p.blocks) || p.blocks.length === 0) bad.push("blocks empty");

  for (const b of p.blocks ?? []) {
    if (b.type === "slide") {
      check(b.image, `${b.id}.image`);
      check(b.narration?.audio, `${b.id}.narration.audio`);
      if (!b.narration?.text) bad.push(`${b.id}.narration.text missing`);
    } else if (b.type === "question") {
      check(b.promptAudio, `${b.id}.promptAudio`);
      check(b.explanations?.correct?.audio, `${b.id}.explanations.correct.audio`);
      check(b.explanations?.incorrect?.audio, `${b.id}.explanations.incorrect.audio`);
      if (b.format === "multiple-choice") {
        if (!b.options?.length) bad.push(`${b.id}.options empty`);
        for (const o of b.options ?? []) check(o.audio, `${b.id}.opt.${o.id}`);
        if (!b.options?.some((o) => o.id === b.correctOptionId)) bad.push(`${b.id}.correctOptionId invalid`);
      } else if (b.format === "true-false") {
        if (typeof b.correctAnswer !== "boolean") bad.push(`${b.id}.correctAnswer not boolean`);
      } else if (b.format === "fill-blank") {
        for (const c of b.chips ?? []) check(c.audio, `${b.id}.chip.${c.id}`);
        if (!b.template?.includes("{{")) bad.push(`${b.id}.template missing blank token`);
        for (const blank of b.blanks ?? []) {
          if (!b.chips?.some((c) => c.id === blank.correctChipId)) bad.push(`${b.id}.blank ${blank.id} correctChipId invalid`);
        }
      } else {
        bad.push(`${b.id}: unknown format ${b.format}`);
      }
    } else {
      bad.push(`unknown block type ${b.type}`);
    }
  }

  if (bad.length) throw new Error(`payload validation failed:\n  ${bad.join("\n  ")}`);
  return p;
}

export { keys, slugify };
