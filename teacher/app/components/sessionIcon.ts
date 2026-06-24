// ============================================================================
// sessionIcon — resolve a payload's lucide glyph name → a rendered badge.
// Web mirror of mobile/src/data/sessionIcons.ts: same 28-name allow-list (the
// pipeline Author's ICON_ENUM) + a deterministic color so each topic gets a
// stable, distinct badge. Unknown/missing → a neutral lightbulb.
// ============================================================================
import {
  Droplets, Sprout, Globe, FlaskConical, Atom, Calculator, BookOpen, Leaf,
  Sun, Cloud, Rainbow, Zap, Rocket, Brain, Heart, Music, Palette, Landmark,
  Map as MapIcon, Microscope, Dna, Telescope, Mountain, Flame, Snowflake,
  Wind, Star, Lightbulb, type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  droplets: Droplets, sprout: Sprout, globe: Globe, "flask-conical": FlaskConical,
  atom: Atom, calculator: Calculator, "book-open": BookOpen, leaf: Leaf,
  sun: Sun, cloud: Cloud, rainbow: Rainbow, zap: Zap, rocket: Rocket, brain: Brain,
  heart: Heart, music: Music, palette: Palette, landmark: Landmark, map: MapIcon,
  microscope: Microscope, dna: Dna, telescope: Telescope, mountain: Mountain,
  flame: Flame, snowflake: Snowflake, wind: Wind, star: Star, lightbulb: Lightbulb,
};

const PALETTE: { tint: string; bg: string }[] = [
  { tint: "#FF9600", bg: "#FFEAD1" }, // orange
  { tint: "#1CB0F6", bg: "#DDF4FF" }, // blue
  { tint: "#58CC02", bg: "#D7FFB8" }, // green
  { tint: "#7C5CFC", bg: "#ECE7FF" }, // violet
  { tint: "#FF4B4B", bg: "#FFDFE0" }, // red
];

export interface SessionIcon {
  Icon: LucideIcon;
  tint: string;
  bg: string;
}

export function sessionIcon(iconName?: string): SessionIcon {
  const name = iconName && ICONS[iconName] ? iconName : "lightbulb";
  const Icon = ICONS[name] ?? Lightbulb;
  let h = 0;
  for (const ch of name) h = (h + ch.charCodeAt(0)) | 0;
  return { Icon, ...PALETTE[Math.abs(h) % PALETTE.length] };
}
