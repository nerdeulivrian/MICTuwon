// ============================================================================
// usePressLift — the shared Duolingo 3D press physics
// ----------------------------------------------------------------------------
// Every raised control (CTA Button, Option Card) presses the same way: on
// press-in the face sinks `lift` px so its bottom lip vanishes into the floor,
// with a light haptic; on release it springs back. ~100ms ease on the native
// driver (GPU transform, no re-render). One source of truth so the feel is
// identical everywhere — pair it with a dark `base` layer offset `lift` px down.
// ============================================================================
import { useCallback, useRef } from "react";
import { Animated, Easing } from "react-native";
import * as Haptics from "expo-haptics";

export function usePressLift(lift: number) {
  // 0 = raised (resting), 1 = pressed (face sunk onto the base).
  const press = useRef(new Animated.Value(0)).current;

  const animateTo = (toValue: number) =>
    Animated.timing(press, {
      toValue,
      duration: 100,
      easing: Easing.ease,
      useNativeDriver: true,
    }).start();

  const onPressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    animateTo(1);
  };

  const onPressOut = () => animateTo(0);

  // Snap straight back to rest (no animation). For controls that can unmount
  // mid-gesture (e.g. a chip that leaves the pool on tap) — call this when the
  // control returns so a half-finished spring-back doesn't leave it stuck sunk.
  // Stable identity (press is a ref) so it's safe in effect deps.
  const reset = useCallback(() => press.setValue(0), [press]);

  const translateY = press.interpolate({ inputRange: [0, 1], outputRange: [0, lift] });

  return { translateY, onPressIn, onPressOut, reset };
}
