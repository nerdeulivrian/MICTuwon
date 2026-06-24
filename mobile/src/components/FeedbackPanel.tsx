// ============================================================================
// FEEDBACK PANEL  (design.pen → 07 MC Correct / 08 MC Incorrect → Correct/Incorrect Panel)
// ----------------------------------------------------------------------------
// The colored panel that replaces the SKIP/CHECK bar once an answer is revealed.
// Shared by every question format (multiple-choice, true/false, fill-blank) so
// the reveal looks identical everywhere:
//   correct   → green bg, circle-check, "Nice! That's correct", green CONTINUE
//   incorrect → red bg, circle-x, "Not quite", red CONTINUE
// The explanation text comes from the payload; audio playback is owned by the
// question view (this is presentation only).
// ============================================================================
import { StyleSheet, Text, View } from "react-native";
import { CircleCheckBig, CircleX } from "lucide-react-native";
import { colors, spacing, fonts } from "../theme";
import CTAButton from "./CTAButton";

type Props = {
  correct: boolean;
  /** Explanation copy for the answer the learner gave. */
  text: string;
  onContinue: () => void;
};

export default function FeedbackPanel({ correct, text, onContinue }: Props) {
  const tint = correct ? colors.correctText : colors.incorrectText;
  return (
    <View style={[styles.feedback, { backgroundColor: correct ? colors.correctBg : colors.redBg }]}>
      <View style={styles.header}>
        {correct ? (
          <CircleCheckBig size={28} color={tint} strokeWidth={2.5} />
        ) : (
          <CircleX size={28} color={tint} strokeWidth={2.5} />
        )}
        <Text style={[styles.title, { color: tint }]}>
          {correct ? "Nice! That's correct" : "Not quite"}
        </Text>
      </View>
      {text ? <Text style={[styles.text, { color: tint }]}>{text}</Text> : null}
      <CTAButton label="CONTINUE" variant={correct ? "correct" : "danger"} onPress={onContinue} />
    </View>
  );
}

const styles = StyleSheet.create({
  feedback: {
    gap: 12,
    paddingTop: 18,
    paddingHorizontal: spacing.lg,
    paddingBottom: 22,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 20,
  },
  text: {
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 21,
  },
});
