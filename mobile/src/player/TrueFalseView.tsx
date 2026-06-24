// ============================================================================
// TRUE / FALSE  (design.pen → 10 True False / z30Rj)
// ----------------------------------------------------------------------------
// A two-choice question. Owns the area under the top bar: the middle panel
// (prompt + the two big TRUE/FALSE cards) and the state-aware bottom panel,
// which swaps SKIP / CHECK for the shared green/red FeedbackPanel once revealed.
//
// The two cards are tall raised buttons with a fixed identity marker — a green
// check circle for TRUE, a red x circle for FALSE — so the answer reads even
// before you tap. They press with the same Duolingo lift as every other control
// (shared usePressLift). Tapping a card plays the shared "true"/"false" clip.
//
// Flow (mirrors multiple-choice):
//   1. prompt auto-plays; tap the speaker to replay. cards show default.
//   2. tap TRUE or FALSE → it goes `selected` (blue); CHECK enables.
//   3. CHECK → reveal: the card matching the answer turns green; a wrong pick
//      turns red; the other card dims. The bottom becomes the FeedbackPanel and
//      its explanation audio auto-plays.
//   4. CONTINUE in the feedback panel advances. SKIP advances (recorded wrong).
// ============================================================================
import { useEffect, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Check, X } from "lucide-react-native";
import { useAudioPlayer } from "expo-audio";
import type { TrueFalseQuestion, SharedAssets } from "../types/payload";
import { resolveUri } from "../assets/resolver";
import { colors, spacing, fonts } from "../theme";
import { CTAButton, FeedbackPanel, SpeakerButton } from "../components";
import { usePressLift } from "../components/usePressLift";

type Props = {
  question: TrueFalseQuestion;
  /** Source of the shared "true" / "false" word clips played on selection. */
  sharedAssets: SharedAssets;
  /** Called once when the answer is revealed, with whether it was correct. */
  onResolved?: (correct: boolean) => void;
  /** Advance to the next block. */
  onContinue: () => void;
};

type TFState = "default" | "selected" | "correct" | "incorrect";

const LIP = 4; // raised lip / press travel — matches the design shadow offset y:4
const CARD_RADIUS = 18; // design corner radius for the TF cards

export default function TrueFalseView({ question, sharedAssets, onResolved, onContinue }: Props) {
  const [selected, setSelected] = useState<boolean | null>(null);
  const [revealed, setRevealed] = useState(false);

  // Prompt auto-plays; the explanation player is seeded with the "correct" clip
  // and re-pointed at the "incorrect" one if the answer is wrong. The choice
  // player speaks the shared "true"/"false" word as the learner taps.
  const promptPlayer = useAudioPlayer({ uri: resolveUri(question.promptAudio) });
  const explPlayer = useAudioPlayer({ uri: resolveUri(question.explanations.correct.audio) });
  const choicePlayer = useAudioPlayer({ uri: resolveUri(sharedAssets.trueAudio) });

  useEffect(() => {
    promptPlayer.play();
  }, [promptPlayer]);

  const isCorrect = selected === question.correctAnswer;

  const selectAnswer = (value: boolean) => {
    if (revealed) return;
    setSelected(value);
    promptPlayer.pause();
    choicePlayer.replace({ uri: resolveUri(value ? sharedAssets.trueAudio : sharedAssets.falseAudio) });
    choicePlayer.play();
  };

  const reveal = () => {
    if (selected === null || revealed) return;
    setRevealed(true);
    promptPlayer.pause();
    choicePlayer.pause();
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
    choicePlayer.pause();
    promptPlayer.seekTo(0);
    promptPlayer.play();
  };

  const cardState = (value: boolean): TFState => {
    if (!revealed) return value === selected ? "selected" : "default";
    if (value === question.correctAnswer) return "correct";
    if (value === selected) return "incorrect"; // the wrong one the user picked
    return "default";
  };

  // After reveal, fade the card that's neither the answer nor the user's pick.
  const dimmed = (value: boolean) =>
    revealed && value !== question.correctAnswer && value !== selected;

  return (
    <View style={styles.root}>
      <View style={styles.middle}>
        <View style={styles.prompt}>
          <View style={styles.promptTop}>
            <SpeakerButton onPress={replayPrompt} />
            <Text style={styles.typeLabel}>TRUE OR FALSE</Text>
          </View>
          <Text style={styles.statement}>{question.prompt}</Text>
        </View>

        <View style={styles.cards}>
          {[true, false].map((value) => (
            <TFButton
              key={value ? "true" : "false"}
              value={value}
              state={cardState(value)}
              dimmed={dimmed(value)}
              disabled={revealed}
              onPress={() => selectAnswer(value)}
            />
          ))}
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
            <CTAButton label="CHECK" onPress={reveal} disabled={selected === null} />
          </View>
        </View>
      )}
    </View>
  );
}

// ── The big TRUE / FALSE card ──────────────────────────────────────────────
// Same base/face lift as the CTA button & option card. The icon is the card's
// identity (TRUE = check, FALSE = x); the colors carry the state feedback.

type TFColors = { face: string; edge: string; label: string };

const TF_STATES: Record<TFState, TFColors> = {
  default: { face: colors.bg, edge: colors.border, label: colors.text },
  selected: { face: colors.blueBg, edge: colors.blue, label: colors.text },
  correct: { face: colors.correctBg, edge: colors.correctText, label: colors.correctText },
  incorrect: { face: colors.redBg, edge: colors.red, label: colors.incorrectText },
};

/**
 * The icon circle. The icon is always the card's identity (TRUE = check,
 * FALSE = x) — it never changes. Only the color carries the state: solid green
 * once this card is the correct answer, solid red once it's the wrong pick,
 * and the soft identity tint (green for TRUE, red for FALSE) otherwise.
 */
function circle(state: TFState, value: boolean): { Icon: typeof Check; bg: string; icon: string } {
  const Icon = value ? Check : X;
  if (state === "correct") return { Icon, bg: colors.correctText, icon: colors.bg };
  if (state === "incorrect") return { Icon, bg: colors.red, icon: colors.bg };
  return value
    ? { Icon, bg: colors.correctBg, icon: colors.correctText }
    : { Icon, bg: colors.redBg, icon: colors.red };
}

function TFButton({
  value,
  state,
  dimmed,
  disabled,
  onPress,
}: {
  value: boolean;
  state: TFState;
  dimmed: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const s = TF_STATES[state];
  const { Icon, bg, icon } = circle(state, value);
  const { translateY, onPressIn, onPressOut } = usePressLift(LIP);
  const interactive = !disabled;
  const faceTransform = interactive ? { transform: [{ translateY }] } : undefined;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={interactive ? onPressIn : undefined}
      onPressOut={interactive ? onPressOut : undefined}
      disabled={!interactive}
      // Flatten the base+face stack before dimming, else Android applies the
      // 0.45 per-layer and the gray base bleeds through the translucent face
      // (a white sliver shows above the base's 4px offset).
      needsOffscreenAlphaCompositing={dimmed}
      style={[styles.tfWrapper, { opacity: dimmed ? 0.45 : 1 }]}
    >
      <View style={[styles.tfBase, { backgroundColor: s.edge }]} />
      <Animated.View style={[styles.tfFace, { backgroundColor: s.face, borderColor: s.edge }, faceTransform]}>
        <View style={[styles.circle, { backgroundColor: bg }]}>
          <Icon size={22} color={icon} strokeWidth={3} />
        </View>
        <Text style={[styles.tfLabel, { color: s.label }]}>{value ? "TRUE" : "FALSE"}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  middle: {
    flex: 1,
    paddingVertical: 18,
    paddingHorizontal: spacing.lg,
    gap: 40,
  },
  prompt: { gap: 24 },
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
  statement: {
    fontFamily: fonts.extraBold,
    fontSize: 26,
    lineHeight: 34,
    color: colors.text,
  },
  cards: { gap: 14 },
  tfWrapper: {
    borderRadius: CARD_RADIUS,
    alignSelf: "stretch",
  },
  tfBase: {
    position: "absolute",
    left: 0,
    right: 0,
    top: LIP,
    bottom: 0, // base kept INSIDE the wrapper (face's marginBottom grows it by
    // LIP) so dimming's offscreen compositing has no overhang to clip.
    borderRadius: CARD_RADIUS,
  },
  tfFace: {
    alignItems: "center",
    gap: 10,
    borderRadius: CARD_RADIUS,
    borderWidth: 2,
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
    marginBottom: LIP, // grows the wrapper so the lip strip sits inside it
  },
  circle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  tfLabel: {
    fontFamily: fonts.extraBold,
    fontSize: 16,
    letterSpacing: 0.8,
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
