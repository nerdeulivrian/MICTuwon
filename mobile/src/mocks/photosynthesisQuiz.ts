// ============================================================================
// MOCK PAYLOAD — PHOTOSYNTHESIS
// ----------------------------------------------------------------------------
// A complete, typed quiz payload: 2 slides + all three question formats, each
// with both correct AND incorrect explanations. Drives the player with zero
// backend. Mirrors docs/payload-example.jsonc.
// ============================================================================
import type { Payload } from "../types/payload";
import { mockImage, mockAudio, mockSharedAssets } from "./assets";

export const photosynthesisQuiz: Payload = {
  sessionId: "demo-quiz",
  title: "Introduction to Photosynthesis",
  createdBy: "Ms. Rivera",
  icon: "leaf",
  estimatedMinutes: 5,
  summary:
    "Learn what photosynthesis is, the role of sunlight, and the inputs and outputs of the process.",
  config: { voice: "Rachel", language: "en-US" },
  sharedAssets: mockSharedAssets,
  blocks: [
    {
      type: "slide",
      id: "slide-1",
      title: "What is Photosynthesis?",
      image: mockImage("photo-slide-1"),
      narration: {
        text: "Plants turn sunlight, water, and carbon dioxide into food and oxygen.",
        audio: mockAudio("slide-1"),
      },
    },
    {
      type: "slide",
      id: "slide-2",
      title: "Why Sunlight Matters",
      image: mockImage("photo-slide-2"),
      narration: {
        text: "Sunlight is the energy source that powers the whole reaction inside the leaf.",
        audio: mockAudio("slide-2"),
      },
    },
    {
      type: "question",
      id: "q-1",
      format: "multiple-choice",
      prompt: "What gas do plants release during photosynthesis?",
      promptAudio: mockAudio("q1-prompt"),
      options: [
        { id: "a", text: "Oxygen", audio: mockAudio("q1-a") },
        { id: "b", text: "Carbon dioxide", audio: mockAudio("q1-b") },
        { id: "c", text: "Nitrogen", audio: mockAudio("q1-c") },
      ],
      correctOptionId: "a",
      explanations: {
        correct: {
          text: "Right! Plants release oxygen as a byproduct.",
          audio: mockAudio("q1-correct"),
        },
        incorrect: {
          text: "Not quite — plants take in CO₂ and release oxygen.",
          audio: mockAudio("q1-wrong"),
        },
      },
    },
    {
      type: "question",
      id: "q-2",
      format: "true-false",
      prompt: "Photosynthesis happens only at night.",
      promptAudio: mockAudio("q2-prompt"),
      correctAnswer: false,
      explanations: {
        correct: {
          text: "Correct — photosynthesis needs light, so it happens during the day.",
          audio: mockAudio("q2-correct"),
        },
        incorrect: {
          text: "Actually it needs sunlight, so it happens during the day.",
          audio: mockAudio("q2-wrong"),
        },
      },
    },
    {
      type: "question",
      id: "q-3",
      format: "fill-blank",
      prompt: "Complete the sentence:",
      promptAudio: mockAudio("q3-prompt"),
      template:
        "Plants absorb {{b1}} through their roots and {{b2}} through their leaves.",
      blanks: [
        { id: "b1", correctChipId: "c1" },
        { id: "b2", correctChipId: "c3" },
      ],
      chips: [
        { id: "c1", text: "water", audio: mockAudio("q3-c1") },
        { id: "c2", text: "oxygen", audio: mockAudio("q3-c2") },
        { id: "c3", text: "carbon dioxide", audio: mockAudio("q3-c3") },
        { id: "c4", text: "sugar", audio: mockAudio("q3-c4") },
      ],
      explanations: {
        correct: {
          text: "Exactly! Water comes from the roots, CO₂ from the leaves.",
          audio: mockAudio("q3-correct"),
        },
        incorrect: {
          text: "Roots take in water; leaves take in carbon dioxide.",
          audio: mockAudio("q3-wrong"),
        },
      },
    },
  ],
};
