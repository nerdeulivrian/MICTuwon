// ============================================================================
// SESSION ICON  (resolve a payload's lucide glyph name → a rendered badge)
// ----------------------------------------------------------------------------
// Each session carries an `icon` — the lucide glyph the Author (Gemini) picks
// when it generates the payload (💧 droplets for The Water Cycle, 🌱 sprout for
// growth…). It identifies the session everywhere it appears: the Library card
// badge AND the Intro hero badge. This module turns that NAME into a rendered
// icon + on-brand badge colors, so both screens stay in sync from one source.
//
// The allow-list mirrors the pipeline Author's ICON_ENUM
// (infra/pipeline/assemble.mjs); unknown/missing names fall back to a neutral
// lightbulb so a badge always renders.
// ============================================================================
import {
  Droplets, Sprout, Globe, FlaskConical, Atom, Calculator, BookOpen, Leaf,
  Sun, Cloud, Rainbow, Zap, Rocket, Brain, Heart, Music, Palette, Landmark,
  Map as MapIcon, Microscope, Dna, Telescope, Mountain, Flame, Snowflake,
  Wind, Star, Lightbulb, type LucideIcon,
} from "lucide-react-native";
import { colors } from "../theme";

export interface SessionIcon {
  /** Lucide glyph drawn inside the badge. */
  Icon: LucideIcon;
  /** Glyph color. */
  tint: string;
  /** Badge tile background. */
  bg: string;
}

// kebab lucide name → component. Mirrors infra/pipeline/assemble.mjs ICON_ENUM.
const ICONS: Record<string, LucideIcon> = {
  droplets: Droplets, sprout: Sprout, globe: Globe, "flask-conical": FlaskConical,
  atom: Atom, calculator: Calculator, "book-open": BookOpen, leaf: Leaf,
  sun: Sun, cloud: Cloud, rainbow: Rainbow, zap: Zap, rocket: Rocket, brain: Brain,
  heart: Heart, music: Music, palette: Palette, landmark: Landmark, map: MapIcon,
  microscope: Microscope, dna: Dna, telescope: Telescope, mountain: Mountain,
  flame: Flame, snowflake: Snowflake, wind: Wind, star: Star, lightbulb: Lightbulb,
};

// On-brand badge color pairs; chosen deterministically from the icon name so
// each topic gets a stable, distinct-feeling badge (Duolingo-ish variety).
const PALETTE: { tint: string; bg: string }[] = [
  { tint: colors.blue, bg: colors.blueBg },
  { tint: colors.primary, bg: colors.primaryBg },
  { tint: colors.correct, bg: colors.correctBg },
  { tint: colors.amberDark, bg: colors.yellowBg },
];

/**
 * Resolve a session's content glyph from its payload `icon` (a lucide name).
 * Unknown/missing → a neutral lightbulb. Badge color is derived from the name
 * so it's stable across renders and varied across topics.
 */
export function sessionIcon(iconName?: string): SessionIcon {
  const name = iconName && ICONS[iconName] ? iconName : "lightbulb";
  const Icon = ICONS[name] ?? Lightbulb;
  let h = 0;
  for (const ch of name) h = (h + ch.charCodeAt(0)) | 0;
  return { Icon, ...PALETTE[Math.abs(h) % PALETTE.length] };
}
