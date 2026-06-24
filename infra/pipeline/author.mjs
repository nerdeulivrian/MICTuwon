// ============================================================================
// author.mjs — the AUTHOR stage (Gemini structured output → text-only draft)
// ----------------------------------------------------------------------------
// Turns a topic + light config (#slides, #questions) into the loose pedagogical
// DRAFT that assemble.mjs consumes. Gemini only writes TEXT (titles, narration,
// questions, answers, explanations, image *prompts*, an icon) — never URLs, ids,
// or option letters; those are assigned deterministically downstream.
//
// Uses structured output (generationConfig.responseFormat.text.schema) so the
// model returns a JSON object matching `draftSchema` — the single biggest
// reliability lever (no prose parsing). See gemini.mjs for the call shape.
// ============================================================================
import { generateJSON, MODELS } from "./gemini.mjs";
import { ICON_ENUM } from "./assemble.mjs";

// ── JSON Schema the model must fill (a subset JSON Schema; see structured docs) ─
// Each block is one of four clearly-typed variants (anyOf) so the model fills
// exactly the right fields for slides vs each question format.
const slideVariant = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["slide"] },
    title: { type: "string", description: "Short slide title (a few words)." },
    narrationText: {
      type: "string",
      description:
        "One or two natural spoken sentences that TEACH this slide (read aloud as narration). No markdown.",
    },
    imagePrompt: {
      type: "string",
      description:
        "A rich, detailed prompt for an image model to render ONE visually striking 16:9 teaching slide. Describe a specific, engaging scene or diagram with a clear focal subject, a dynamic but uncluttered composition, a sense of depth, and a vibrant, harmonious color palette with appealing lighting — in a modern, polished illustration style (a beautifully designed Canva or keynote slide, NOT a plain bullet list or a bland stock photo). It MUST include a short, bold, legible on-slide TITLE plus a few clear labels on the key parts, with text kept minimal and large enough to read. Write 2-4 vivid sentences describing the actual scene, style, colors, and labels — never a keyword list.",
    },
  },
  required: ["type", "title", "narrationText", "imagePrompt"],
};

const mcVariant = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["question"] },
    format: { type: "string", enum: ["multiple-choice"] },
    prompt: { type: "string", description: "The question text." },
    options: {
      type: "array",
      description: "2 to 4 answer options (plain text, no letters/numbering).",
      items: { type: "string" },
      minItems: 2,
      maxItems: 4,
    },
    correctIndex: { type: "integer", description: "0-based index of the correct option." },
    explanationCorrect: { type: "string", description: 'Spoken affirmation then why it is right, e.g. "Yes, exactly! ..." (1-2 short sentences, read aloud).' },
    explanationIncorrect: { type: "string", description: 'Gentle spoken reaction then the correct answer and why, e.g. "Hmm, not quite — ..." (1-2 short sentences, read aloud).' },
  },
  required: ["type", "format", "prompt", "options", "correctIndex", "explanationCorrect", "explanationIncorrect"],
};

const tfVariant = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["question"] },
    format: { type: "string", enum: ["true-false"] },
    prompt: { type: "string", description: "A statement that is clearly true or clearly false." },
    correctAnswer: { type: "boolean", description: "true if the statement is true." },
    explanationCorrect: { type: "string", description: 'Spoken affirmation then why, e.g. "Yes, correct! ..." (1-2 short sentences, read aloud).' },
    explanationIncorrect: { type: "string", description: 'Gentle spoken correction then the truth, e.g. "Not quite — ..." (1-2 short sentences, read aloud).' },
  },
  required: ["type", "format", "prompt", "correctAnswer", "explanationCorrect", "explanationIncorrect"],
};

const fbVariant = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["question"] },
    format: { type: "string", enum: ["fill-blank"] },
    prompt: { type: "string", description: 'Short instruction, e.g. "Complete the sentence:".' },
    template: {
      type: "string",
      description:
        "A sentence containing EXACTLY ONE blank written as the literal token {{blank}}. Example: 'The powerhouse of the cell is the {{blank}}.'",
    },
    answer: { type: "string", description: "The correct word/phrase that fills {{blank}}." },
    distractors: {
      type: "array",
      description: "1 to 3 plausible but WRONG words/phrases (chip choices).",
      items: { type: "string" },
      minItems: 1,
      maxItems: 3,
    },
    explanationCorrect: { type: "string", description: 'Spoken affirmation then why, e.g. "Yes! ..." (1-2 short sentences, read aloud).' },
    explanationIncorrect: { type: "string", description: 'Gentle spoken reaction then the right word and why, e.g. "Close! The answer is ..." (1-2 short sentences, read aloud).' },
  },
  required: ["type", "format", "prompt", "template", "answer", "distractors", "explanationCorrect", "explanationIncorrect"],
};

export const draftSchema = {
  type: "object",
  properties: {
    title: { type: "string", description: "Engaging session title." },
    summary: { type: "string", description: "One-sentence description shown on the intro screen." },
    icon: { type: "string", enum: ICON_ENUM, description: "The single best-fitting glyph for this topic." },
    estimatedMinutes: { type: "integer", description: "Rough minutes to complete (2-10)." },
    blocks: {
      type: "array",
      description: "Lesson blocks in deliberate teaching order — interleave slides (teach) and questions (assess) into a purposeful arc; may open with a question.",
      items: { anyOf: [slideVariant, mcVariant, tfVariant, fbVariant] },
      minItems: 1,
    },
  },
  required: ["title", "summary", "icon", "blocks"],
};

export function buildPrompt({ topic, slides, questions, sequence }) {
  const lines = [
    `You are an expert lesson author for a Duolingo-style learning app.`,
    `Create a single, self-contained QUIZ session that teaches: "${topic}".`,
    ``,
    `Structure:`,
  ];

  if (sequence && sequence.length) {
    // Explicit ordering: the caller dictates the exact block-by-block sequence.
    const ordered = sequence
      .map((s, i) => {
        if (s.type === "slide") return `  ${i + 1}. slide`;
        if (s.format) return `  ${i + 1}. question — format: ${s.format}`;
        return `  ${i + 1}. question — choose the best format (multiple-choice, true-false, or fill-blank)`;
      })
      .join("\n");
    lines.push(
      `- Produce EXACTLY ${sequence.length} blocks, in THIS EXACT ORDER (do not reorder, add, or omit any):`,
      ordered,
      `- A question that appears before any slide is a deliberate "cold"/diagnostic check — write it so it still makes sense on its own, without relying on a preceding slide.`
    );
  } else {
    // No explicit order: nudge a sensible pedagogical layout and let the model choose formats.
    const formatGuidance =
      questions >= 3
        ? "Use a MIX of the three question formats (multiple-choice, true-false, fill-blank) — include at least one of each when possible."
        : "Choose the most fitting question format(s) from: multiple-choice, true-false, fill-blank.";
    lines.push(
      `- Include exactly ${slides} slide block${slides === 1 ? "" : "s"} and exactly ${questions} question block${questions === 1 ? "" : "s"} — but YOU decide the order.`,
      `- Design it like a real lesson with a deliberate arc, NOT a slides-then-quiz dump. Reason about pacing: you can OPEN with a hook or quick diagnostic question to spark curiosity, TEACH a concept with a slide, CHECK it right after with a question, then build toward the next idea. Interleave assessments between the teaching so understanding is checked as it is introduced.`,
      `- Do NOT default to slide-first, and do NOT clump all the slides together. Genuinely vary the rhythm — leading with a question or hook is often the strongest opening. A question before any slide is a valid cold/diagnostic check; phrase it so it stands on its own. Close on whichever block (slide or question) best lands the lesson.`,
      `- The whole thing should feel like one complete, purposefully sequenced lesson with assessments woven in — every block earning its place in the flow.`,
      `- ${formatGuidance}`
    );
  }

  lines.push(
    ``,
    `Content rules:`,
    `- Audience: a curious general learner. Be accurate, clear, and concise.`,
    `- Slide narrationText: 1-2 natural spoken sentences (this is read aloud).`,
    `- Slide imagePrompt: make each slide genuinely good-looking and NOT boring — a vivid, modern illustration with a strong focal subject, appealing colors, and a clean, dynamic layout, while keeping a short bold on-slide title and legible labels. Vary the visual approach to fit the concept (labeled diagram, real-world scene, cross-section, or simple infographic). Avoid clutter, tiny text, and generic stock imagery.`,
    `- Question feedback is SPOKEN aloud to the learner, so write it like a warm tutor reacting in the moment (single attempt, no retry):`,
    `  • explanationCorrect — open with a short affirming reaction ("Yes, that's right!", "Exactly!", "Nice work!"), then one quick sentence on why it's correct.`,
    `  • explanationIncorrect — open with a gentle, encouraging reaction ("Hmm, not quite.", "Close!", "Good try —"), then give the correct answer and why. Never harsh or discouraging.`,
    `  • 1-2 short, natural spoken sentences each. No markdown, no "Correct:"/"Incorrect:" labels.`,
    `- fill-blank: the template must contain exactly one {{blank}} token.`,
    `- Pick the icon that best matches the topic from the allowed list.`,
    ``,
    `Return ONLY the structured JSON object.`
  );
  return lines.join("\n");
}

/**
 * Author a text-only draft for a topic. Returns the raw draft object (not yet
 * normalized). Validates the requested block counts and fails loud on mismatch
 * so the orchestrator can retry once.
 */
export async function authorDraft({ topic, slides = 1, questions = 3, sequence = null, apiKey, model = MODELS.author }) {
  if (!topic || !topic.trim()) throw new Error("authorDraft: topic is required");
  const prompt = buildPrompt({ topic: topic.trim(), slides, questions, sequence });
  const draft = await generateJSON({ prompt, schema: draftSchema, apiKey, model });

  const blocks = Array.isArray(draft.blocks) ? draft.blocks : [];

  // When an explicit sequence is given, validate the EXACT block-by-block order
  // (type, plus format where the caller pinned one). Otherwise validate counts.
  if (sequence && sequence.length) {
    if (blocks.length !== sequence.length) {
      throw new Error(
        `authorDraft: sequence mismatch — asked for ${sequence.length} blocks, got ${blocks.length}`
      );
    }
    for (let i = 0; i < sequence.length; i++) {
      const want = sequence[i];
      const got = blocks[i] || {};
      if (got.type !== want.type) {
        throw new Error(
          `authorDraft: block ${i + 1} should be a ${want.type}, got ${got.type ?? "nothing"}`
        );
      }
      if (want.format && got.format !== want.format) {
        throw new Error(
          `authorDraft: block ${i + 1} should be a ${want.format} question, got ${got.format ?? "nothing"}`
        );
      }
    }
    return draft;
  }

  const gotSlides = blocks.filter((b) => b.type === "slide").length;
  const gotQuestions = blocks.filter((b) => b.type === "question").length;
  if (gotSlides !== slides || gotQuestions !== questions) {
    throw new Error(
      `authorDraft: count mismatch — asked ${slides} slides / ${questions} questions, got ${gotSlides} / ${gotQuestions}`
    );
  }
  return draft;
}
