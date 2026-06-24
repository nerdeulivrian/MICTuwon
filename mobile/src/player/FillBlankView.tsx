// ============================================================================
// FILL IN THE BLANK  (design.pen → 09 Fill In Blank / niD0o)
// ----------------------------------------------------------------------------
// A drag-free cloze question. Owns the area under the top bar: the middle panel
// (prompt + the sentence with its blanks + the word bank) and the state-aware
// bottom panel, which swaps SKIP / CHECK for the shared FeedbackPanel on reveal.
//
// The sentence comes from `template` ("…absorb {{b1}} through…"); each {{id}}
// renders an inline blank. Tapping a word chip fills the LEFT-MOST empty blank
// and the chip leaves the pool as a faint ghost (so the bank never reflows).
// Tapping a filled blank pops its chip back. CHECK enables once every blank is
// filled, then reveals: each blank turns green (right chip) or red (wrong chip).
//
// Flow (mirrors the other activities):
//   1. prompt auto-plays; tap the speaker to replay. blanks empty, chips raised.
//   2. tap chips to fill blanks left-to-right; tap a blank to undo.
//   3. CHECK → reveal: correct blanks green, wrong blanks red; the bottom becomes
//      the FeedbackPanel and its explanation audio auto-plays.
//   4. CONTINUE advances. SKIP advances (recorded wrong).
// ============================================================================
import { useEffect, useMemo, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useAudioPlayer } from "expo-audio";
import type { FillBlankQuestion } from "../types/payload";
import { resolveUri } from "../assets/resolver";
import { colors, spacing, fonts } from "../theme";
import { CTAButton, FeedbackPanel, SpeakerButton } from "../components";
import { usePressLift } from "../components/usePressLift";

type Props = {
  question: FillBlankQuestion;
  /** Called once when the answer is revealed, with whether it was correct. */
  onResolved?: (correct: boolean) => void;
  /** Advance to the next block. */
  onContinue: () => void;
};

const LIP = 4; // raised lip / press travel — matches the design shadow offset y:4
const RADIUS = 12; // design corner radius for chips + blanks

// A sentence is a flat list of word/blank tokens parsed once from the template.
type Token = { kind: "word"; text: string } | { kind: "blank"; blankId: string };

/** Split "Plants absorb {{b1}} …" into word + blank tokens (one word per chip
 *  so the sentence wraps at word boundaries). */
function parseTemplate(template: string): Token[] {
  const tokens: Token[] = [];
  const re = /\{\{(\w+)\}\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const pushWords = (chunk: string) => {
    for (const w of chunk.split(/\s+/).filter(Boolean)) tokens.push({ kind: "word", text: w });
  };
  while ((m = re.exec(template))) {
    pushWords(template.slice(last, m.index));
    tokens.push({ kind: "blank", blankId: m[1] });
    last = m.index + m[0].length;
  }
  pushWords(template.slice(last));
  return tokens;
}

export default function FillBlankView({ question, onResolved, onContinue }: Props) {
  // Which chip sits in each blank (null = empty). Keyed by blank id.
  const [placements, setPlacements] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(question.blanks.map((b) => [b.id, null]))
  );
  const [revealed, setRevealed] = useState(false);

  // Prompt auto-plays; the explanation player is seeded with the "correct" clip
  // and re-pointed at the "incorrect" one if wrong. The chip player speaks the
  // word as the learner drops it into a blank.
  const promptPlayer = useAudioPlayer({ uri: resolveUri(question.promptAudio) });
  const explPlayer = useAudioPlayer({ uri: resolveUri(question.explanations.correct.audio) });
  const chipPlayer = useAudioPlayer({ uri: resolveUri(question.chips[0]?.audio ?? "") });

  useEffect(() => {
    promptPlayer.play();
  }, [promptPlayer]);

  const tokens = useMemo(() => parseTemplate(question.template), [question.template]);
  const chipsById = useMemo(
    () => Object.fromEntries(question.chips.map((c) => [c.id, c])),
    [question.chips]
  );
  const blanksById = useMemo(
    () => Object.fromEntries(question.blanks.map((b) => [b.id, b])),
    [question.blanks]
  );

  const usedChipIds = new Set(Object.values(placements).filter(Boolean) as string[]);
  const allFilled = question.blanks.every((b) => placements[b.id]);
  const isCorrect = question.blanks.every((b) => placements[b.id] === b.correctChipId);

  // Drop a chip into the first still-empty blank (left-to-right) + speak it.
  const placeChip = (chipId: string) => {
    if (revealed || usedChipIds.has(chipId)) return;
    const next = question.blanks.find((b) => !placements[b.id]);
    if (!next) return;
    setPlacements((p) => ({ ...p, [next.id]: chipId }));
    promptPlayer.pause();
    chipPlayer.replace({ uri: resolveUri(chipsById[chipId].audio) });
    chipPlayer.play();
  };

  // Tap a filled blank to send its chip back to the pool.
  const clearBlank = (blankId: string) => {
    if (revealed || !placements[blankId]) return;
    setPlacements((p) => ({ ...p, [blankId]: null }));
  };

  const reveal = () => {
    if (!allFilled || revealed) return;
    setRevealed(true);
    promptPlayer.pause();
    chipPlayer.pause();
    if (isCorrect) {
      explPlayer.seekTo(0);
      explPlayer.play();
    } else if (question.explanations.incorrect) {
      explPlayer.replace({ uri: resolveUri(question.explanations.incorrect.audio) });
      explPlayer.play();
    }
    onResolved?.(isCorrect);
  };

  const skip = () => {
    onResolved?.(false);
    onContinue();
  };

  const replayPrompt = () => {
    chipPlayer.pause();
    promptPlayer.seekTo(0);
    promptPlayer.play();
  };

  // Per-blank visual: empty gray, raised white once filled, green/red on reveal.
  const blankVisual = (blankId: string): BlankVisual => {
    const chipId = placements[blankId];
    if (!chipId) return "empty";
    if (!revealed) return "filled";
    return chipId === blanksById[blankId].correctChipId ? "correct" : "incorrect";
  };

  return (
    <View style={styles.root}>
      <View style={styles.middle}>
        <View style={styles.topGroup}>
          <View style={styles.promptTop}>
            <SpeakerButton onPress={replayPrompt} />
            <Text style={styles.typeLabel}>FILL IN THE BLANK</Text>
          </View>

          <View style={styles.sentence}>
            {tokens.map((t, i) =>
              t.kind === "word" ? (
                <Text key={`w${i}`} style={styles.word}>
                  {t.text}
                </Text>
              ) : (
                <BlankSlot
                  key={`b${i}`}
                  visual={blankVisual(t.blankId)}
                  text={placements[t.blankId] ? chipsById[placements[t.blankId]!].text : ""}
                  interactive={!revealed && !!placements[t.blankId]}
                  onPress={() => clearBlank(t.blankId)}
                />
              )
            )}
          </View>
        </View>

        <View style={styles.bank}>
          <Text style={styles.bankLabel}>TAP A WORD TO FILL THE BLANK</Text>
          <View style={styles.pool}>
            {question.chips.map((chip) => (
              <ChipButton
                key={chip.id}
                text={chip.text}
                used={usedChipIds.has(chip.id)}
                disabled={revealed}
                onPress={() => placeChip(chip.id)}
              />
            ))}
          </View>
        </View>
      </View>

      {revealed ? (
        <FeedbackPanel
          correct={isCorrect}
          text={
            isCorrect
              ? question.explanations.correct.text
              : question.explanations.incorrect?.text ?? ""
          }
          onContinue={onContinue}
        />
      ) : (
        <View style={styles.bottom}>
          <CTAButton label="SKIP" variant="neutral" fullWidth={false} onPress={skip} />
          <View style={styles.checkWrap}>
            <CTAButton label="CHECK" onPress={reveal} disabled={!allFilled} />
          </View>
        </View>
      )}
    </View>
  );
}

// ── The inline blank ───────────────────────────────────────────────────────
// Empty: a flat gray slot. Filled: a raised white card with the 4px lip (the
// base sits inside the wrapper so it aligns with the chips). Green/red on reveal.

type BlankVisual = "empty" | "filled" | "correct" | "incorrect";

const BLANK_COLORS: Record<Exclude<BlankVisual, "empty">, { face: string; base: string; text: string }> = {
  filled: { face: colors.bg, base: colors.border, text: colors.text },
  correct: { face: colors.correctBg, base: colors.correctText, text: colors.correctText },
  incorrect: { face: colors.redBg, base: colors.red, text: colors.incorrectText },
};

function BlankSlot({
  visual,
  text,
  interactive,
  onPress,
}: {
  visual: BlankVisual;
  text: string;
  interactive: boolean;
  onPress: () => void;
}) {
  if (visual === "empty") return <View style={styles.blankEmpty} />;

  const c = BLANK_COLORS[visual];
  return (
    <Pressable onPress={onPress} disabled={!interactive} style={styles.blankWrapper}>
      <View style={[styles.blankBase, { backgroundColor: c.base }]} />
      <View style={[styles.blankFace, { backgroundColor: c.face, borderColor: c.base }]}>
        <Text style={[styles.blankText, { color: c.text }]}>{text}</Text>
      </View>
    </Pressable>
  );
}

// ── A word-bank chip ─────────────────────────────────────────────────────────
// Raised white card with the shared press lift. Once placed it leaves a faint
// ghost of the same footprint so the pool never reflows.

function ChipButton({
  text,
  used,
  disabled,
  onPress,
}: {
  text: string;
  used: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { translateY, onPressIn, onPressOut, reset } = usePressLift(LIP);

  // A chip unmounts its lifted face the instant it's placed (the press-out
  // never lands), so the lift can stick "sunk". Snap it back to rest whenever
  // the chip is in the pool, so a returned chip always shows its raised lip.
  useEffect(() => {
    if (!used) reset();
  }, [used, reset]);

  if (used) {
    return (
      <View style={styles.chipGhost}>
        {/* transparent text reserves the chip's exact width so nothing shifts */}
        <Text style={[styles.chipText, { color: "transparent" }]}>{text}</Text>
      </View>
    );
  }

  const interactive = !disabled;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={interactive ? onPressIn : undefined}
      onPressOut={interactive ? onPressOut : undefined}
      disabled={!interactive}
      style={styles.chipWrapper}
    >
      <View style={styles.chipBase} />
      <Animated.View style={[styles.chipFace, interactive ? { transform: [{ translateY }] } : undefined]}>
        <Text style={styles.chipText}>{text}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  middle: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: spacing.lg,
    gap: 40,
  },
  // Header packs to the left (default start); only the sentence below centers.
  topGroup: { alignSelf: "stretch", gap: 24 },
  promptTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  typeLabel: {
    fontFamily: fonts.extraBold,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.textMuted,
  },

  // Sentence: words + blanks flow and wrap line-to-line.
  sentence: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    columnGap: 8,
    rowGap: 10,
  },
  word: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.text,
  },

  blankEmpty: {
    minWidth: 104,
    height: 44,
    borderRadius: RADIUS,
    backgroundColor: "#E6E6E6",
    marginBottom: LIP, // match the filled chip's footprint so baselines align
  },
  blankWrapper: { borderRadius: RADIUS },
  blankBase: {
    position: "absolute",
    left: 0,
    right: 0,
    top: LIP,
    bottom: 0, // lip kept inside the wrapper (face's marginBottom grows it)
    borderRadius: RADIUS,
  },
  blankFace: {
    minWidth: 104,
    borderRadius: RADIUS,
    borderWidth: 2,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: LIP,
  },
  blankText: {
    fontFamily: fonts.extraBold,
    fontSize: 20,
  },

  // Word bank.
  bank: { alignSelf: "stretch", alignItems: "center", gap: 12 },
  bankLabel: {
    fontFamily: fonts.extraBold,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.textMuted,
  },
  pool: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    columnGap: 10,
    rowGap: 12,
  },
  chipWrapper: { borderRadius: RADIUS },
  chipBase: {
    position: "absolute",
    left: 0,
    right: 0,
    top: LIP,
    bottom: 0,
    borderRadius: RADIUS,
    backgroundColor: colors.border,
  },
  chipFace: {
    borderRadius: RADIUS,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    paddingVertical: 11,
    paddingHorizontal: 18,
    marginBottom: LIP,
  },
  chipGhost: {
    borderRadius: RADIUS,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 11,
    paddingHorizontal: 18,
    marginBottom: LIP,
  },
  chipText: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    color: colors.text,
  },

  bottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 14,
    paddingHorizontal: spacing.lg,
    paddingBottom: 20,
    borderTopWidth: 2,
    borderTopColor: colors.border,
  },
  checkWrap: { flex: 1 },
});
