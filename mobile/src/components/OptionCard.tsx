// ============================================================================
// OPTION CARD  (design.pen → "Option Card" / Xun1S, states from 06–08 MC)
// ----------------------------------------------------------------------------
// A selectable answer row: letter badge + label, on a raised card with the
// same hard 4px lip as the CTA button (shadow offset y:4, color = border).
// Four states pulled verbatim from the MC screens:
//   default    white face, gray border/lip, outlined gray badge
//   selected   blue tint (#DDF4FF), blue border, blue badge
//   correct    green tint (#D7FFB8), green border, filled green badge
//   incorrect  red tint (#FFDFE0), red border, filled red badge
// After an answer is revealed, the options the user didn't engage with fade to
// `dimmed` (opacity 0.45) — also from the design.
//
// Pressing uses the exact same Duolingo 3D lift as the CTA button (shared
// usePressLift): a dark `base` block sits LIP px below the `face`, and on press
// the face sinks onto it so the lip vanishes + a light haptic fires. Once the
// answer is revealed the card is disabled, so it stays flat at rest.
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

export type OptionState = "default" | "selected" | "correct" | "incorrect";

type Props = {
  /** Badge letter (A/B/C/D). Omit to hide the badge. */
  letter?: string;
  label: string;
  state?: OptionState;
  /** Fade out (used for non-answer options once feedback shows). */
  dimmed?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const LIP = 4; // hard drop-shadow offset from design (y:4, no blur)

type StateStyle = {
  face: string;
  edge: string; // border + lip color
  badgeBorder: string;
  badgeFill?: string;
  letter: string;
  label: string;
};

const STATES: Record<OptionState, StateStyle> = {
  default: {
    face: colors.bg,
    edge: colors.border,
    badgeBorder: colors.border,
    letter: colors.textMuted,
    label: colors.text,
  },
  selected: {
    face: colors.blueBg,
    edge: colors.blue,
    badgeBorder: colors.blue,
    letter: colors.blue,
    label: colors.text,
  },
  correct: {
    face: colors.correctBg,
    edge: colors.correctText,
    badgeBorder: colors.correctText,
    badgeFill: colors.correctText,
    letter: colors.bg,
    label: colors.correctText,
  },
  incorrect: {
    face: colors.redBg,
    edge: colors.red,
    badgeBorder: colors.red,
    badgeFill: colors.red,
    letter: colors.bg,
    label: colors.incorrectText,
  },
};

export default function OptionCard({
  letter,
  label,
  state = "default",
  dimmed = false,
  onPress,
  disabled = false,
  style,
}: Props) {
  const s = STATES[state];
  const { translateY, onPressIn, onPressOut } = usePressLift(LIP);
  const interactive = !disabled && !!onPress;

  // Once disabled (answer revealed) the card sits flat — no lift, no animation.
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
      style={[styles.wrapper, { opacity: dimmed ? 0.45 : 1 }, style]}
    >
      {/* The "shadow" block: same shape as the face, offset LIP px down. */}
      <View style={[styles.base, { backgroundColor: s.edge }]} />
      <Animated.View
        style={[styles.face, { backgroundColor: s.face, borderColor: s.edge }, faceTransform]}
      >
        {letter ? (
          <View
            style={[
              styles.badge,
              { borderColor: s.badgeBorder, backgroundColor: s.badgeFill ?? "transparent" },
            ]}
          >
            <Text style={[styles.letter, { color: s.letter }]}>{letter}</Text>
          </View>
        ) : null}
        <Text style={[styles.label, { color: s.label }]} numberOfLines={3}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radii.lg,
    alignSelf: "stretch",
  },
  base: {
    position: "absolute",
    left: 0,
    right: 0,
    top: LIP,
    bottom: 0, // base = the face shape shifted down by LIP, kept INSIDE the
    // wrapper (the face's marginBottom grows the wrapper by LIP) so dimming's
    // offscreen compositing has no overhang to clip.
    borderRadius: radii.lg,
  },
  face: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg - 2,
    borderRadius: radii.lg,
    borderWidth: 2,
    paddingVertical: 15,
    paddingHorizontal: spacing.lg,
    marginBottom: LIP, // grows the wrapper so the lip strip sits inside it
  },
  badge: {
    width: 30,
    height: 30,
    borderRadius: radii.sm,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  letter: {
    fontFamily: fonts.extraBold,
    fontSize: 14,
  },
  label: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: fontSizes.base,
  },
});
