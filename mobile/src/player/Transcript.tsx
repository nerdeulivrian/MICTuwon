// ============================================================================
// TRANSCRIPT  (design.pen → 04 Slide "Transcript" card)
// ----------------------------------------------------------------------------
// The narration text shown statically inside a #F7F7F7 card with a
// "NOW PLAYING" header while the audio plays. (Word-by-word karaoke was removed
// with the move to Gemini TTS — we now just show the full transcript text.)
//
// The card height is fixed by the layout (it fills the gap below the slide
// image), so a long narration SCROLLS inside it — the header stays pinned and
// the text lives in a ScrollView so it never spills past the card's edge.
// ============================================================================
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Volume2 } from "lucide-react-native";
import { colors, radii, spacing, fonts } from "../theme";

type Props = {
  text: string;
};

export default function Transcript({ text }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Volume2 size={16} color={colors.primary} strokeWidth={2.5} />
        <Text style={styles.headerLabel}>NOW PLAYING</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator
      >
        <Text style={styles.text}>{text.trim()}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 18,
    gap: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerLabel: {
    fontFamily: fonts.extraBold,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.textMuted,
  },
  // Fills the card below the header and clips overflow — long narration scrolls
  // here instead of spilling past the card's rounded edge.
  scroll: {
    flex: 1,
  },
  body: {
    paddingBottom: spacing.sm,
  },
  text: {
    fontFamily: fonts.bold,
    fontSize: 19,
    lineHeight: 28,
    color: colors.text,
  },
});
