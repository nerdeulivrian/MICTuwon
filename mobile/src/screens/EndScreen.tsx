// ============================================================================
// END (QUIZ)  (design.pen → 11 End Quiz / Pnxe1)
// ----------------------------------------------------------------------------
// The graded close to a session. A trophy hero, a "Lesson complete!" headline +
// an accuracy-aware subtitle, a three-stat row (SCORE · ACCURACY · TIME), and a
// FINISH button that returns to the Library. Every session is a quiz, so this
// is the only end screen.
//
// The score tally (correct / total / elapsed) is handed in via the route params
// by SessionScreen when the last block advances.
// ============================================================================
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Trophy } from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { colors, fonts } from "../theme";
import { CTAButton } from "../components";

type Props = NativeStackScreenProps<RootStackParamList, "End">;

/** Elapsed seconds → m:ss, matching the in-session top-bar timer. */
function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

/** A warm one-liner that scales with how the learner did. */
function subtitleFor(accuracy: number): string {
  if (accuracy >= 0.9) return "Awesome work! You aced this one.";
  if (accuracy >= 0.6) return "Nice work! You're getting the hang of it.";
  return "Good effort! Review and try again to level up.";
}

export default function EndScreen({ navigation, route }: Props) {
  const { correct, total, elapsedSeconds } = route.params;
  const accuracy = total > 0 ? correct / total : 0;

  const stats: { value: string; label: string; bg: string; fg: string }[] = [
    { value: `${correct}/${total}`, label: "SCORE", bg: colors.primaryBg, fg: colors.primary },
    { value: `${Math.round(accuracy * 100)}%`, label: "ACCURACY", bg: colors.blueBg, fg: colors.blueDark },
    { value: formatTime(elapsedSeconds), label: "TIME", bg: colors.yellowBg, fg: colors.amberDark },
  ];

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <View style={styles.topGroup}>
          <View style={styles.trophyBadge}>
            <Trophy size={60} color={colors.yellow} strokeWidth={2} fill={colors.yellow} />
          </View>

          <Text style={styles.title}>Lesson complete!</Text>
          <Text style={styles.subtitle}>{subtitleFor(accuracy)}</Text>

          <View style={styles.stats}>
            {stats.map((s) => (
              <View key={s.label} style={[styles.stat, { backgroundColor: s.bg }]}>
                <Text style={[styles.statValue, { color: s.fg }]}>{s.value}</Text>
                <Text style={[styles.statLabel, { color: s.fg }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <CTAButton label="FINISH" onPress={() => navigation.popToTop()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 28,
  },
  // Hero + stats, lifted toward the top third (design: padding-top 44, gap 20).
  topGroup: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
    paddingTop: 44,
  },
  trophyBadge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.yellowBg,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 30,
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: colors.textSecondary,
    textAlign: "center",
  },
  // Three equal-width stat cards.
  stats: {
    flexDirection: "row",
    alignSelf: "stretch",
    gap: 12,
    paddingTop: 12,
  },
  stat: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 5,
  },
  statValue: {
    fontFamily: fonts.extraBold,
    fontSize: 24,
  },
  statLabel: {
    fontFamily: fonts.extraBold,
    fontSize: 11,
    letterSpacing: 0.8,
  },
});
