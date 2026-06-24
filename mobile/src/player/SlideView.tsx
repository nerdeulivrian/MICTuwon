// ============================================================================
// SLIDE VIEW  (design.pen → 04 Slide middle panel)
// ----------------------------------------------------------------------------
// Renders a SlideBlock: a 16:9 image above the narration Transcript. Narration
// audio auto-plays when the slide mounts via expo-audio; tapping the image (or
// the transcript) replays it. The transcript shows the narration text statically
// (word-by-word karaoke was removed with the move to Gemini TTS).
//
// (Full-screen landscape — design.pen 05 — is cut from the MVP: the app is
// portrait-locked and runs in Expo Go, so true rotation needs a custom dev
// client. The 16:9 image + transcript is the teaching moment on its own.)
// ============================================================================
import { useEffect } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { useAudioPlayer } from "expo-audio";
import type { SlideBlock } from "../types/payload";
import { resolveUri } from "../assets/resolver";
import { colors, radii, spacing } from "../theme";
import Transcript from "./Transcript";

type Props = {
  slide: SlideBlock;
};

export default function SlideView({ slide }: Props) {
  const player = useAudioPlayer({ uri: resolveUri(slide.narration.audio) });

  // Auto-play narration when the slide appears.
  useEffect(() => {
    player.play();
  }, [player]);

  const replay = () => {
    player.seekTo(0);
    player.play();
  };

  return (
    <View style={styles.middle}>
      <Pressable style={styles.imageWrap} onPress={replay}>
        <Image
          source={{ uri: resolveUri(slide.image) }}
          style={styles.image}
          resizeMode="cover"
        />
      </Pressable>

      <Pressable style={styles.transcriptTap} onPress={replay}>
        <Transcript text={slide.narration.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  middle: {
    flex: 1,
    gap: spacing.lg - 2,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  imageWrap: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  transcriptTap: {
    flex: 1,
  },
});
