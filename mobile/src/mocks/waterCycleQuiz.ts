// ============================================================================
// MOCK PAYLOAD — THE WATER CYCLE
// ----------------------------------------------------------------------------
// A second quiz payload (1 slide + all three question formats) so the Library
// lists more than one session. Like every session it's a single-attempt graded
// quiz: each question carries both correct AND incorrect explanations.
// ============================================================================
import type { Payload } from "../types/payload";
import { mockImage, mockAudio, mockSharedAssets } from "./assets";

export const waterCycleQuiz: Payload = {
  sessionId: "demo-water",
  title: "The Water Cycle",
  createdBy: "Mr. Santos",
  icon: "droplets",
  estimatedMinutes: 4,
  summary:
    "Learn the stages of the water cycle: evaporation, condensation, and precipitation.",
  config: { voice: "Rachel", language: "en-US" },
  sharedAssets: mockSharedAssets,
  blocks: [
    {
      type: "slide",
      id: "slide-1",
      title: "The Water Cycle",
      image: mockImage("water-slide-1"),
      narration: {
        text: "Water moves between the ground, the air, and the clouds in a continuous cycle.",
        audio: mockAudio("wc-slide-1"),
      },
    },
    {
      type: "question",
      id: "q-1",
      format: "multiple-choice",
      prompt: "What is it called when water turns into vapor and rises?",
      promptAudio: mockAudio("wc-q1-prompt"),
      options: [
        { id: "a", text: "Evaporation", audio: mockAudio("wc-q1-a") },
        { id: "b", text: "Condensation", audio: mockAudio("wc-q1-b") },
        { id: "c", text: "Precipitation", audio: mockAudio("wc-q1-c") },
      ],
      correctOptionId: "a",
      explanations: {
        correct: {
          text: "Yes! Evaporation is water rising as vapor.",
          audio: mockAudio("wc-q1-correct"),
        },
        incorrect: {
          text: "Not quite — water rising as vapor is called evaporation.",
          audio: mockAudio("wc-q1-wrong"),
        },
      },
    },
    {
      type: "question",
      id: "q-2",
      format: "true-false",
      prompt: "Clouds form during condensation.",
      promptAudio: mockAudio("wc-q2-prompt"),
      correctAnswer: true,
      explanations: {
        correct: {
          text: "Correct — vapor cools and condenses into clouds.",
          audio: mockAudio("wc-q2-correct"),
        },
        incorrect: {
          text: "Actually it's true — vapor cools and condenses into clouds.",
          audio: mockAudio("wc-q2-wrong"),
        },
      },
    },
    {
      type: "question",
      id: "q-3",
      format: "fill-blank",
      prompt: "Complete the sentence:",
      promptAudio: mockAudio("wc-q3-prompt"),
      template: "Rain and snow falling from clouds is called {{b1}}.",
      blanks: [{ id: "b1", correctChipId: "c2" }],
      chips: [
        { id: "c1", text: "evaporation", audio: mockAudio("wc-q3-c1") },
        { id: "c2", text: "precipitation", audio: mockAudio("wc-q3-c2") },
        { id: "c3", text: "condensation", audio: mockAudio("wc-q3-c3") },
      ],
      explanations: {
        correct: {
          text: "Exactly! Precipitation is rain or snow falling to the ground.",
          audio: mockAudio("wc-q3-correct"),
        },
        incorrect: {
          text: "Rain or snow falling from clouds is called precipitation.",
          audio: mockAudio("wc-q3-wrong"),
        },
      },
    },
  ],
};
