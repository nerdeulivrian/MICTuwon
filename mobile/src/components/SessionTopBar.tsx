// ============================================================================
// SESSION TOP BAR  (design.pen → "Session Top Bar" / kUiiM)
// ----------------------------------------------------------------------------
// The persistent in-session header: close (X) · progress track · timer.
//   - X          lucide "x", #AFAFAF, 30
//   - progress   #E5E5E5 track (h18, r9) with an #FF9600 fill, fills remaining width
//   - timer      lucide "timer" #777777 + m:ss label, Nunito 15/700
// Progress is driven by `progress` (0..1); the timer by `elapsedSeconds`.
// ============================================================================
import { StyleSheet, Text, View, Pressable } from "react-native";
import { X, Timer } from "lucide-react-native";
import { colors, spacing, fontSizes, fonts } from "../theme";

type Props = {
  /** 0..1 — fraction of blocks completed. */
  progress: number;
  /** Seconds since the session started; rendered as m:ss. */
  elapsedSeconds: number;
  onClose?: () => void;
};

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function SessionTopBar({ progress, elapsedSeconds, onClose }: Props) {
  const pct = Math.max(0, Math.min(1, progress));

  return (
    <View style={styles.bar}>
      <Pressable onPress={onClose} hitSlop={8}>
        <X size={30} color={colors.textMuted} strokeWidth={2.5} />
      </Pressable>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
      </View>

      <View style={styles.timer}>
        <Timer size={17} color={colors.textSecondary} strokeWidth={2.5} />
        <Text style={styles.timeValue}>{formatTime(elapsedSeconds)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.bg,
  },
  track: {
    flex: 1,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  fill: {
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
  },
  timer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  timeValue: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.body,
    color: colors.textSecondary,
  },
});
