// ============================================================================
// MULTIPLE CHOICE  (design.pen → 06 Multiple Choice / 07 MC Correct / 08 MC Incorrect)
// ----------------------------------------------------------------------------
// A single-correct question. Owns the whole area under the top bar: the middle
// panel (prompt + options) and the state-aware bottom panel, which swaps from
// SKIP / CONTINUE to a colored feedback panel once the answer is revealed.
//
// Flow (from the design):
//   1. prompt auto-plays; tap the speaker to replay it. options show default.
//   2. tap an option → it goes `selected` (blue) and speaks its own clip
//      (interrupting the prompt / a prior option); CONTINUE enables.
//   3. CONTINUE → reveal: the correct option turns green; a wrong pick turns
//      red; every other option dims. The bottom becomes the correct/incorrect
//      feedback panel (green/red) and its explanation audio auto-plays.
//   4. CONTINUE in the feedback panel advances to the next block.
//   SKIP advances immediately (recorded as not-correct).
// ============================================================================
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAudioPlayer } from "expo-audio";
import type { MultipleChoiceQuestion } from "../types/payload";
import { resolveUri } from "../assets/resolver";
import { colors, spacing, fonts } from "../theme";
import { OptionCard, CTAButton, FeedbackPanel, SpeakerButton, type OptionState } from "../components";

type Props = {
  question: MultipleChoiceQuestion;
  /** Called once when the answer is revealed, with whether it was correct. */
  onResolved?: (correct: boolean) => void;
  /** Advance to the next block. */
  onContinue: () => void;
};

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export default function MultipleChoiceView({ question, onResolved, onContinue }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  // Prompt narration auto-plays; the explanation player is seeded with the
  // "correct" clip and re-pointed at the "incorrect" one if the answer is wrong.
  // The option player speaks each choice's own clip as the learner taps it.
  const promptPlayer = useAudioPlayer({ uri: resolveUri(question.promptAudio) });
  const explPlayer = useAudioPlayer({
    uri: resolveUri(question.explanations.correct.audio),
  });
  const optionPlayer = useAudioPlayer({ uri: resolveUri(question.options[0]?.audio ?? "") });

  useEffect(() => {
    promptPlayer.play();
  }, [promptPlayer]);

  const isCorrect = selectedId === question.correctOptionId;

  // Select an option + speak its clip, interrupting the prompt / a prior pick.
  const selectOption = (optId: string, audio: string) => {
    if (revealed) return;
    setSelectedId(optId);
    promptPlayer.pause();
    optionPlayer.replace({ uri: resolveUri(audio) });
    optionPlayer.play();
  };

  const reveal = () => {
    if (!selectedId || revealed) return;
    setRevealed(true);
    promptPlayer.pause();
    optionPlayer.pause();
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
    optionPlayer.pause();
    promptPlayer.seekTo(0);
    promptPlayer.play();
  };

  const optionState = (optId: string): OptionState => {
    if (!revealed) return optId === selectedId ? "selected" : "default";
    if (optId === question.correctOptionId) return "correct";
    if (optId === selectedId) return "incorrect"; // the wrong one the user picked
    return "default";
  };

  // After reveal, fade everything that's neither the answer nor the user's pick.
  const dimmed = (optId: string) =>
    revealed && optId !== question.correctOptionId && optId !== selectedId;

  return (
    <View style={styles.root}>
      <View style={styles.middle}>
        <View style={styles.prompt}>
          <View style={styles.promptTop}>
            <SpeakerButton onPress={replayPrompt} />
            <Text style={styles.typeLabel}>SELECT THE CORRECT ANSWER</Text>
          </View>
          <Text style={styles.question}>{question.prompt}</Text>
        </View>

        <View style={styles.options}>
          {question.options.map((opt, i) => (
            <OptionCard
              key={opt.id}
              letter={LETTERS[i]}
              label={opt.text}
              state={optionState(opt.id)}
              dimmed={dimmed(opt.id)}
              disabled={revealed}
              onPress={() => selectOption(opt.id, opt.audio)}
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
          <View style={styles.continueWrap}>
            <CTAButton label="CONTINUE" onPress={reveal} disabled={!selectedId} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  middle: {
    flex: 1,
    paddingVertical: 18,
    paddingHorizontal: spacing.lg,
    gap: 22,
  },
  prompt: { gap: 14 },
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
  question: {
    fontFamily: fonts.extraBold,
    fontSize: 24,
    lineHeight: 30,
    color: colors.text,
  },
  options: { gap: 15 },
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
  continueWrap: { flex: 1 },
});
