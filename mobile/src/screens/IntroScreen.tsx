// ============================================================================
// INTRO  (design.pen → 03 Intro / TWyws)
// ----------------------------------------------------------------------------
// The session's cover screen: a nav bar (back + state-driven Delete), a hero
// badge with the session's content icon, title, author, summary, meta chips,
// and a state-driven main CTA.
//
// DOWNLOAD = OWNERSHIP (see PLANNING.md): a session is acquired by downloading
// it here. The screen has two states keyed on "is this session downloaded?":
//   - NOT downloaded → main CTA is DOWNLOAD; no top-right action.
//   - downloaded     → main CTA is LET'S GO; top-right shows Delete.
// Tapping DOWNLOAD runs the (simulated) download manager with a progress bar,
// then the store flips this session to downloaded → CTA becomes LET'S GO, the
// Delete action appears, and the session joins the Library shelf. Tapping
// Delete removes it, stays on this screen, and reverts the CTA to DOWNLOAD.
//
// REAL-DATA ONLY: the design's "YOUR NAME" input is omitted — the payload has
// no learner-name field yet (deferred, see PROGRESS.md).
// ============================================================================
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ArrowLeft, Trash2, Timer, ListChecks } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, fontSizes, fonts, radii } from "../theme";
import { loadPayload } from "../data/loader";
import { sessionIcon } from "../data/sessionIcons";
import { useIsDownloaded } from "../data/downloads";
import { downloadSession, deleteSession } from "../data/downloadManager";
import type { Payload } from "../types/payload";
import { isSlide } from "../types/payload";
import { CTAButton } from "../components";

type Props = NativeStackScreenProps<RootStackParamList, "Intro">;

export default function IntroScreen({ navigation, route }: Props) {
  const { sessionId } = route.params;
  const insets = useSafeAreaInsets();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { downloaded } = useIsDownloaded(sessionId);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    loadPayload(sessionId)
      .then(setPayload)
      .catch((e) => setError(String(e)));
  }, [sessionId]);

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  const onDownload = async () => {
    setDownloading(true);
    setProgress(0);
    try {
      await downloadSession(sessionId, (p) => {
        if (mounted.current) setProgress(p.fraction);
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Leave it un-downloaded; the CTA falls back to DOWNLOAD so it's retryable.
    } finally {
      if (mounted.current) setDownloading(false);
    }
  };

  const onDelete = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void deleteSession(sessionId);
  };

  if (error) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.error}>{error}</Text>
        <CTAButton
          label="GO BACK"
          variant="neutral"
          fullWidth={false}
          onPress={() => navigation.goBack()}
        />
      </View>
    );
  }

  if (!payload) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const questionCount = payload.blocks.filter((b) => !isSlide(b)).length;
  const { Icon, tint, bg } = sessionIcon(payload.icon);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Nav bar: back + (when downloaded) Delete */}
      <View style={styles.navBar}>
        <Pressable
          style={({ pressed }) => [styles.iconBtn, pressed && styles.navPressed]}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={8}
        >
          <ArrowLeft size={22} color={colors.text} strokeWidth={2.5} />
        </Pressable>
        {downloaded && (
          <Pressable
            style={({ pressed }) => [styles.deleteBtn, pressed && styles.navPressed]}
            onPress={onDelete}
            accessibilityLabel="Delete download"
            accessibilityRole="button"
          >
            <Trash2 size={18} color={colors.redDark} strokeWidth={2.5} />
            <Text style={styles.deleteLabel}>Delete</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.body}>
        {/* Hero badge — the session's content icon */}
        <View style={[styles.heroBadge, { backgroundColor: bg }]}>
          <Icon size={64} color={tint} strokeWidth={2.5} />
        </View>

        <Text style={styles.title}>{payload.title}</Text>

        <View style={styles.author}>
          <Avatar name={payload.createdBy} />
          <Text style={styles.by}>Created by {payload.createdBy}</Text>
        </View>

        <Text style={styles.summary}>{payload.summary}</Text>

        <View style={styles.chips}>
          <MetaChip Icon={Timer} label={`~${payload.estimatedMinutes} min`} />
          <MetaChip
            Icon={ListChecks}
            label={`${questionCount} ${questionCount === 1 ? "question" : "questions"}`}
          />
        </View>
      </View>

      <View style={{ paddingBottom: insets.bottom + spacing.sm }}>
        {downloaded ? (
          <CTAButton
            label="LET'S GO"
            onPress={() => navigation.navigate("Session", { sessionId })}
          />
        ) : downloading ? (
          <DownloadingButton progress={progress} />
        ) : (
          <CTAButton label="DOWNLOAD" onPress={onDownload} />
        )}
      </View>
    </View>
  );
}

// The DOWNLOAD button mid-download: a flat primary-colored bar with a progress
// fill behind a "DOWNLOADING… NN%" label. Not pressable while it runs. Mirrors
// the CTAButton face shape so the swap to LET'S GO is seamless.
function DownloadingButton({ progress }: { progress: number }) {
  const pct = Math.round(progress * 100);
  return (
    <View style={styles.downloadingBar} accessibilityRole="progressbar">
      <View style={[styles.downloadingFill, { width: `${pct}%` }]} />
      <Text style={styles.downloadingLabel}>DOWNLOADING… {pct}%</Text>
    </View>
  );
}

// Small circular author avatar showing the first initial (design: blue chip).
function Avatar({ name }: { name: string }) {
  const initial = name.replace(/^(Ms\.|Mr\.|Mrs\.|Dr\.)\s*/i, "").trim()[0] ?? "?";
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initial.toUpperCase()}</Text>
    </View>
  );
}

// A pill chip with a leading icon (time / question count).
function MetaChip({ Icon, label }: { Icon: LucideIcon; label: string }) {
  return (
    <View style={styles.chip}>
      <Icon size={17} color={colors.textSecondary} strokeWidth={2.5} />
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.lg,
  },

  // Nav bar
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.redBg,
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
  },
  navPressed: { opacity: 0.6 },
  deleteLabel: {
    fontSize: 14,
    fontFamily: fonts.extraBold,
    color: colors.redDark,
  },

  // DOWNLOAD button while running — flat bar with a left-to-right progress fill.
  downloadingBar: {
    alignSelf: "stretch",
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.primaryBg,
    marginBottom: 4, // match CTAButton's lip reserve so the swap doesn't jump
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  downloadingFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.primary,
  },
  downloadingLabel: {
    fontFamily: fonts.extraBold,
    fontSize: fontSizes.base,
    letterSpacing: 0.8,
    color: colors.primaryDark, // reads on the light track AND the orange fill
  },

  // Body
  body: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.lg,
  },
  heroBadge: {
    width: 128,
    height: 128,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: fontSizes.heading,
    fontFamily: fonts.extraBold,
    color: colors.text,
    textAlign: "center",
  },
  author: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 14,
    fontFamily: fonts.extraBold,
    color: colors.bg,
  },
  by: {
    fontSize: fontSizes.body,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
  },
  summary: {
    fontSize: fontSizes.base,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 25,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: colors.surface,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 20,
  },
  chipText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
  },
  error: {
    fontSize: fontSizes.body,
    color: colors.redDark,
    textAlign: "center",
  },
});
