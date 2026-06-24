// ============================================================================
// SESSION SCREEN — the 3-panel in-session shell
// ----------------------------------------------------------------------------
// The spine the whole player runs inside:
//   ┌ Session Top Bar ┐  X · progress · timer
//   ├ Middle Panel    ┤  the current block (slide / question)
//   └ Bottom Panel    ┘  state-aware CTA (CONTINUE for slides)
// It owns the session state every block type shares: which block we're on, the
// elapsed timer, advancing (last block → End), and the per-question results
// tally for scoring. Block-specific UI is delegated: slides → SlideView,
// multiple-choice → MultipleChoiceView (other formats land here next).
//
// Slides get a plain CONTINUE bar from the shell; questions own their own
// state-aware bottom panel (SKIP/CONTINUE → feedback), so the shell stays out
// of their way and just renders them full-height.
// ============================================================================
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, fontSizes } from "../theme";
import { loadPayload } from "../data/loader";
import type { Payload, Block } from "../types/payload";
import { isSlide, isMultipleChoice, isTrueFalse, isFillBlank } from "../types/payload";
import { SessionTopBar, CTAButton } from "../components";
import SlideView from "../player/SlideView";
import MultipleChoiceView from "../player/MultipleChoiceView";
import TrueFalseView from "../player/TrueFalseView";
import FillBlankView from "../player/FillBlankView";

type Props = NativeStackScreenProps<RootStackParamList, "Session">;

export default function SessionScreen({ navigation, route }: Props) {
  const { sessionId } = route.params;
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  // Per-question correctness, keyed by block id — the score for the End screen.
  const resultsRef = useRef<Record<string, boolean>>({});

  // Load the session payload.
  useEffect(() => {
    loadPayload(sessionId)
      .then(setPayload)
      .catch((e) => setError(String(e)));
  }, [sessionId]);

  // Continuous, non-strict timer — ticks once the payload is in.
  const startedRef = useRef(false);
  useEffect(() => {
    if (!payload || startedRef.current) return;
    startedRef.current = true;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [payload]);

  if (error) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </SafeAreaView>
    );
  }

  if (!payload) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  const blocks = payload.blocks;
  const block = blocks[index];
  // Progress counts every block; the bar fills as each is completed.
  const progress = (index + 1) / blocks.length;

  const advance = () => {
    if (index < blocks.length - 1) {
      setIndex((i) => i + 1);
    } else {
      // Tally the scored questions (slides don't count) for the End screen.
      const total = blocks.filter((b) => b.type === "question").length;
      const correct = Object.values(resultsRef.current).filter(Boolean).length;
      navigation.replace("End", { sessionId, correct, total, elapsedSeconds: elapsed });
    }
  };

  const close = () => navigation.popToTop();

  const recordResult = (correct: boolean) => {
    resultsRef.current[block.id] = correct;
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <SessionTopBar progress={progress} elapsedSeconds={elapsed} onClose={close} />

      <BlockView
        // Remount per block so each renderer resets its own state cleanly.
        key={block.id}
        block={block}
        sharedAssets={payload.sharedAssets}
        onResolved={recordResult}
        onContinue={advance}
      />
    </SafeAreaView>
  );
}

/** Routes a block to its renderer. Slides get the shell's CONTINUE bar; */
/** questions own their full layout (middle + state-aware bottom). */
function BlockView({
  block,
  sharedAssets,
  onResolved,
  onContinue,
}: {
  block: Block;
  sharedAssets: Payload["sharedAssets"];
  onResolved: (correct: boolean) => void;
  onContinue: () => void;
}) {
  if (isSlide(block)) {
    return (
      <>
        <View style={styles.middle}>
          <SlideView slide={block} />
        </View>
        <View style={styles.bottom}>
          <CTAButton label="CONTINUE" variant="primary" onPress={onContinue} />
        </View>
      </>
    );
  }

  if (isMultipleChoice(block)) {
    return (
      <MultipleChoiceView
        question={block}
        onResolved={onResolved}
        onContinue={onContinue}
      />
    );
  }

  if (isTrueFalse(block)) {
    return (
      <TrueFalseView
        question={block}
        sharedAssets={sharedAssets}
        onResolved={onResolved}
        onContinue={onContinue}
      />
    );
  }

  if (isFillBlank(block)) {
    return (
      <FillBlankView
        question={block}
        onResolved={onResolved}
        onContinue={onContinue}
      />
    );
  }

  // Every block type is handled above; this is unreachable. If a new format is
  // added to the payload contract, TS flags it here (`block` is `never`).
  return assertNever(block);
}

function assertNever(_block: never): null {
  return null;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.xl,
  },
  middle: { flex: 1 },
  bottom: {
    paddingHorizontal: spacing.lg,
    paddingTop: 14,
    paddingBottom: 20,
    borderTopWidth: 2,
    borderTopColor: colors.border,
  },
  error: { fontSize: fontSizes.body, color: colors.redDark, textAlign: "center" },
});
