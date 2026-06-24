// ============================================================================
// SPEAKER BUTTON  (design.pen → "Speaker" / iXgws)
// ----------------------------------------------------------------------------
// The little replay-audio button that sits above every question prompt. In the
// design it's a 44×44 light-blue (#DDF4FF) tile with a volume-2 glyph and a
// SOLID BLUE drop-shadow (#1CB0F6, offset y:4) — i.e. the same raised 3D lip as
// the CTA Button, just blue-on-blue. We recreate the shadow with stacked layers
// (a blue `base` block offset LIP px below the face) and reuse `usePressLift`
// so it sinks-and-springs with a light haptic exactly like every other control.
// ============================================================================
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Volume2 } from "lucide-react-native";
import { colors } from "../theme";
import { usePressLift } from "./usePressLift";

type Props = {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

const LIP = 4; // raised lip / press travel — matches the design shadow offset y:4
const SIZE = 44; // design tile size
const RADIUS = 12; // design corner radius

export default function SpeakerButton({ onPress, style }: Props) {
  const { translateY, onPressIn, onPressOut } = usePressLift(LIP);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={6}
      style={[styles.wrapper, style]}
    >
      {/* The blue "shadow" block: the face shape shifted down by LIP. */}
      <View style={styles.base} />
      <Animated.View style={[styles.face, { transform: [{ translateY }] }]}>
        <Volume2 size={22} color={colors.blue} strokeWidth={2.5} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderRadius: RADIUS },
  base: {
    position: "absolute",
    left: 0,
    right: 0,
    top: LIP,
    bottom: 0, // lip kept inside the wrapper (face's marginBottom grows it)
    borderRadius: RADIUS,
    backgroundColor: colors.blue,
  },
  face: {
    width: SIZE,
    height: SIZE,
    borderRadius: RADIUS,
    backgroundColor: colors.blueBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: LIP,
  },
});
