// ============================================================================
// THEME
// ----------------------------------------------------------------------------
// Design tokens ported verbatim from design.pen (the visual source of truth).
// Colors map 1:1 to the `color-*` variables in the .pen file. Font is Nunito.
// Spacing / radii / shadow scales are added to support the screens.
// ============================================================================

export const colors = {
  // Base
  bg: "#FFFFFF",
  surface: "#F7F7F7",
  border: "#E5E5E5",

  // Text
  text: "#4B4B4B",
  textSecondary: "#777777",
  textMuted: "#AFAFAF",

  // Primary (orange)
  primary: "#FF9600",
  primaryBg: "#FFEAD1",
  primaryDark: "#E08600",

  // Correct (green)
  correct: "#58CC02",
  correctBg: "#D7FFB8",
  correctDark: "#46A302",
  correctText: "#58A700",

  // Incorrect / red
  red: "#FF4B4B",
  redBg: "#FFDFE0",
  redDark: "#EA2B2B",
  incorrectText: "#EA2B2B",

  // Accents
  blue: "#1CB0F6",
  blueBg: "#DDF4FF",
  blueDark: "#1899D6",
  yellow: "#FFC800",
  yellowBg: "#FFF1C2", // soft amber — trophy badge + time-stat background
  amberDark: "#A86E00", // deep amber — time-stat value text
} as const;

/** Nunito everywhere; weights map to the loaded font files (see fonts setup). */
export const fonts = {
  family: "Nunito",
  regular: "Nunito_400Regular",
  medium: "Nunito_600SemiBold",
  bold: "Nunito_700Bold",
  extraBold: "Nunito_800ExtraBold",
} as const;

/** 4px base scale. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const fontSizes = {
  caption: 13,
  body: 15,
  base: 17,
  title: 22,
  heading: 28,
} as const;

export const theme = { colors, fonts, spacing, radii, fontSizes } as const;

export type Theme = typeof theme;
export default theme;
