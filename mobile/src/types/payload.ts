// ============================================================================
// PAYLOAD CONTRACT
// ----------------------------------------------------------------------------
// The single shared type produced by the teacher platform and consumed by this
// student player. The player walks `blocks` top-to-bottom; each block is
// self-describing via its `type`. Everything heavy (images, audio) is a URL —
// online: a full S3/CDN URL; offline: rewritten to a local file path
// by the asset resolver. The payload structure never changes between the two.
//
// Source of truth for the shape: docs/payload-example.jsonc
// ============================================================================

/** A resolvable asset reference: a full https URL online, or a file:// path offline. */
export type AssetUrl = string;

export type QuestionFormat = "multiple-choice" | "true-false" | "fill-blank";

// ── Narration ────────────────────────────────────────────────────────────────

export interface Narration {
  text: string;
  audio: AssetUrl;
}

/** Spoken feedback shown after an answer. */
export interface Explanation {
  text: string;
  audio: AssetUrl;
}

export interface Explanations {
  /** Why the answer is correct. */
  correct: Explanation;
  /** Why a wrong answer is wrong — shown on the single-attempt reveal. */
  incorrect: Explanation;
}

// ── Shared assets (one backend constant, reused across all sessions) ─────────

export interface SharedAssets {
  trueAudio: AssetUrl;
  falseAudio: AssetUrl;
}

export interface Config {
  voice: string;
  language: string;
}

// ── Blocks ───────────────────────────────────────────────────────────────────

export interface SlideBlock {
  type: "slide";
  id: string;
  title: string;
  /** 16:9 image. */
  image: AssetUrl;
  narration: Narration;
}

export interface Option {
  id: string;
  text: string;
  audio: AssetUrl;
}

export interface MultipleChoiceQuestion {
  type: "question";
  id: string;
  format: "multiple-choice";
  prompt: string;
  /** Auto-plays when the question appears. */
  promptAudio: AssetUrl;
  options: Option[];
  correctOptionId: string;
  explanations: Explanations;
}

export interface TrueFalseQuestion {
  type: "question";
  id: string;
  format: "true-false";
  prompt: string;
  promptAudio: AssetUrl;
  correctAnswer: boolean;
  /** No per-option audio — uses sharedAssets.trueAudio / falseAudio. */
  explanations: Explanations;
}

export interface Blank {
  id: string;
  correctChipId: string;
}

export interface Chip {
  id: string;
  text: string;
  audio: AssetUrl;
}

export interface FillBlankQuestion {
  type: "question";
  id: string;
  format: "fill-blank";
  prompt: string;
  promptAudio: AssetUrl;
  /** Sentence with {{b1}} placeholders matching `blanks[].id`. */
  template: string;
  blanks: Blank[];
  chips: Chip[];
  explanations: Explanations;
}

export type QuestionBlock =
  | MultipleChoiceQuestion
  | TrueFalseQuestion
  | FillBlankQuestion;

export type Block = SlideBlock | QuestionBlock;

// ── The payload ──────────────────────────────────────────────────────────────

export interface Payload {
  sessionId: string;
  title: string;
  /** Shown on the intro + end screen. */
  createdBy: string;
  /** Shown on the intro screen. */
  estimatedMinutes: number;
  /** One-line description shown on the intro screen. */
  summary: string;
  /** Lucide glyph name (e.g. "droplets") the Author chose for this session;
   *  drives the Library card + Intro hero badge. Optional for backward-compat
   *  with payloads authored before the field existed (resolver falls back). */
  icon?: string;
  config: Config;
  sharedAssets: SharedAssets;
  blocks: Block[];
}

// ── Type guards ───────────────────────────────────────────────────────────────

export function isSlide(block: Block): block is SlideBlock {
  return block.type === "slide";
}

export function isQuestion(block: Block): block is QuestionBlock {
  return block.type === "question";
}

export function isMultipleChoice(
  block: Block
): block is MultipleChoiceQuestion {
  return block.type === "question" && block.format === "multiple-choice";
}

export function isTrueFalse(block: Block): block is TrueFalseQuestion {
  return block.type === "question" && block.format === "true-false";
}

export function isFillBlank(block: Block): block is FillBlankQuestion {
  return block.type === "question" && block.format === "fill-blank";
}
