// ============================================================================
// CTA BUTTON  (design.pen → "CTA Button" / tqAl0)
// ----------------------------------------------------------------------------
// The one raised button used everywhere (CONTINUE, LET'S GO, Scan QR, …) so
// every primary action looks and feels identical.
//
// Duolingo 3D press — the faithful CSS technique:
//     .btn        { box-shadow: 0 4px 0 <dark>; }      // raised block below
//     .btn:active { box-shadow: none; translateY(4px); } // sinks into the floor
// We can't use a hard box-shadow in RN, so we recreate it with layers: a dark
// `base` block sits LIP px BELOW the colored `face` (same shape, offset down).
//   - resting : the face covers the top; the base shows as a LIP strip at the
//     bottom = the raised lip.
//   - pressed : the face translateY's down by LIP, landing exactly on the base
//     (so the "shadow" visually disappears) and the top LIP strip reveals the
//     background — the button compresses into the ground.
// Transform runs on the native driver (~100ms ease, matching the CSS); a light
// haptic fires on press-in for real tactile feedback on-device.
// ============================================================================
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, radii, spacing, fontSizes, fonts } from "../theme";
import { usePressLift } from "./usePressLift";

export type CTAVariant = "primary" | "correct" | "danger" | "neutral";

type Props = {
  label: string;
  onPress?: () => void;
  variant?: CTAVariant;
  disabled?: boolean;
  /** Stretch to fill the parent's cross-axis (full-width CTA). */
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

const LIP = 4; // raised lip height / press travel — matches design shadow offset y:4

const VARIANTS: Record<CTAVariant, { face: string; base: string; label: string }> = {
  primary: { face: colors.primary, base: colors.primaryDark, label: colors.bg },
  correct: { face: colors.correct, base: colors.correctDark, label: colors.bg },
  danger: { face: colors.red, base: colors.redDark, label: colors.bg },
  neutral: { face: colors.surface, base: colors.border, label: colors.text },
};

export default function CTAButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  fullWidth = true,
  style,
}: Props) {
  const v = VARIANTS[variant];
  const { translateY, onPressIn, onPressOut } = usePressLift(LIP);

  // Disabled: flat gray, no lip, muted label (matches the grayed-out CHECK state).
  if (disabled) {
    return (
      <View style={[styles.face, fullWidth && styles.fullWidth, { backgroundColor: colors.border }, style]}>
        <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[styles.wrapper, fullWidth && styles.fullWidth, style]}
    >
      {/* The "shadow" block: same shape as the face, offset LIP px down. */}
      <View style={[styles.base, { backgroundColor: v.base }]} />
      <Animated.View
        style={[styles.face, { backgroundColor: v.face, transform: [{ translateY }] }]}
      >
        <Text style={[styles.label, { color: v.label }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radii.lg,
    // Shrink-wrap to the label (a column child would otherwise stretch full
    // width). `center` rather than `flex-start` so a non-fullWidth button honors
    // a centering parent instead of pinning left; in a row it only sets the
    // (moot, equal-height) vertical alignment.
    alignSelf: "center",
    marginBottom: LIP, // reserve room for the lip so it never overlaps siblings
  },
  fullWidth: {
    alignSelf: "stretch",
  },
  base: {
    position: "absolute",
    left: 0,
    right: 0,
    top: LIP,
    bottom: -LIP, // base = the face shape shifted down by LIP
    borderRadius: radii.lg,
  },
  face: {
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: fonts.extraBold,
    fontSize: fontSizes.base,
    letterSpacing: 0.8,
  },
});
