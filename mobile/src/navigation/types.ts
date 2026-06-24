// Route map for the root native-stack. `sessionId` threads through from the
// Library/Scanner entry points into the player and end screens.

export type RootStackParamList = {
  Library: undefined;
  Scanner: undefined;
  Intro: { sessionId: string };
  Session: { sessionId: string };
  // The End (Quiz) screen is handed the final tally to render score/accuracy/time.
  End: {
    sessionId: string;
    /** Questions answered correctly. */
    correct: number;
    /** Total scored questions (slides don't count). */
    total: number;
    /** Whole-session elapsed time, in seconds. */
    elapsedSeconds: number;
  };
};
