// ============================================================================
// SESSION LIBRARY  (design.pen → 01 Session Library, "Row 1" bento)
// ----------------------------------------------------------------------------
// The home screen: a uniform bento grid of the sessions DOWNLOADED on this
// device (two equal compact cards per row, matching design.pen's "Row 1").
//
// DOWNLOAD = OWNERSHIP (see PLANNING.md): the Library is the shelf of sessions
// you've downloaded — it IS the offline view, so there is no Home/Offline tab
// bar. You add a session by scanning / entering its code (the orange QR badge →
// Scanner → Intro → Download). A device with nothing downloaded shows an empty
// state prompting a scan; sessions appear here the moment they're downloaded.
//
// REAL-DATA ONLY: the design mocks up state we don't track yet (progress %,
// completed checks, QUIZ/PRACTICE chips). The MVP is quiz-only, so each card
// shows only what the payload summary + download store actually give us.
//
// CARD ICON = PAYLOAD ICON: the colored badge glyph reflects the session's
// *content* (💧 water cycle, 🌱 photosynthesis…), via the shared `sessionIcon()`
// stub the Intro hero badge also uses. The payload has no `icon` field yet; see
// PROGRESS.md (Phase 4 / Phase 7) for the planned contract addition.
// ============================================================================
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { QrCode, ScanLine } from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, fontSizes, fonts, radii } from "../theme";
import { type SessionSummary } from "../data/loader";
import { sessionIcon } from "../data/sessionIcons";
import { useDownloads } from "../data/downloads";
import { usePressLift } from "../components/usePressLift";

type Props = NativeStackScreenProps<RootStackParamList, "Library">;

function metaLine(s: SessionSummary): string {
  const q = `${s.questionCount} ${s.questionCount === 1 ? "question" : "questions"}`;
  return `${q} · ~${s.estimatedMinutes} min`;
}

// Group every session into rows of two equal compact tiles. A trailing odd
// session fills the left slot and an invisible spacer balances the row, so the
// grid keeps one uniform 2-up rhythm (design.pen "Row 1") with no wide cards.
function chunkPairs<T>(arr: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += 2) out.push(arr.slice(i, i + 2));
  return out;
}

export default function LibraryScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { ready, sessions } = useDownloads();

  const open = (sessionId: string) =>
    navigation.navigate("Intro", { sessionId });

  // The shelf reads straight from the downloads store — each session's summary
  // was captured at download time — so it renders with no catalog fetch and no
  // network (the offline = ownership promise). Sorted by title for a stable order.
  const downloaded = [...sessions.values()].sort((a, b) =>
    a.title.localeCompare(b.title)
  );
  const loading = !ready;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xl, flexGrow: 1 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.title}>My Sessions</Text>
            <ScanButton onPress={() => navigation.navigate("Scanner")} />
          </View>
          <Text style={styles.subtitle}>
            {loading
              ? "Loading…"
              : downloaded.length === 0
                ? "Scan a code to add one"
                : `${downloaded.length} ${downloaded.length === 1 ? "session" : "sessions"} · available offline`}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator
            color={colors.primary}
            style={{ marginTop: spacing.xxl }}
          />
        ) : downloaded.length === 0 ? (
          <EmptyShelf onScan={() => navigation.navigate("Scanner")} />
        ) : (
          /* Uniform bento: every session is an equal compact tile, two per
             row (design.pen "Row 1"). A lone trailing card keeps its half-width
             with an invisible spacer beside it. */
          <View style={styles.grid}>
            {chunkPairs(downloaded).map((pair) => (
              <View key={pair[0].sessionId} style={styles.gridRow}>
                {pair.map((s) => (
                  <SquareCard key={s.sessionId} session={s} onPress={open} />
                ))}
                {pair.length === 1 && <View style={styles.gridSpacer} />}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// The orange QR badge (design.pen "Scan Btn" / L5nXLC): a 50×50 button with a
// hard 4px lip in primaryDark. Like the bento cards, RN ignores shadow* on
// Android, so the lip is a stacked `primaryDark` base under the orange face;
// pressing uses the shared usePressLift so the face sinks onto the base (lip
// vanishes + light haptic), matching every other raised control.
function ScanButton({ onPress }: { onPress: () => void }) {
  const { translateY, onPressIn, onPressOut } = usePressLift(SCAN_LIP);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityLabel="Scan a QR code"
      accessibilityRole="button"
      hitSlop={8}
    >
      <View style={styles.scanLip} />
      <Animated.View style={[styles.scanFace, { transform: [{ translateY }] }]}>
        <QrCode size={26} color={colors.bg} strokeWidth={2.5} />
      </Animated.View>
    </Pressable>
  );
}

// A square bento tile: badge top, then title + meta. Used in 2-up rows.
//
// The design's card has a hard 4px drop-shadow (offset y:4, no blur, border
// color). RN drops shadowColor/Offset/Radius on Android, so — like CTAButton /
// OptionCard — we fake the lip with a stacked layer: a base block in the border
// color sits LIP px below the white face, leaving a crisp 4px ledge at the
// bottom. `face` fills the wrapper (flex) so both cards in a row stay equal
// height and the ledge lands at the same place. On press the face sinks onto
// the lip (shared usePressLift → translateY + light haptic), same 3D feel as
// the buttons.
function SquareCard({
  session,
  onPress,
}: {
  session: SessionSummary;
  onPress: (id: string) => void;
}) {
  const { Icon, tint, bg } = sessionIcon(session.icon);
  const { translateY, onPressIn, onPressOut } = usePressLift(LIP);
  return (
    <Pressable
      style={styles.cardWrapper}
      onPress={() => onPress(session.sessionId)}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <View style={styles.cardLip} />
      <Animated.View style={[styles.cardFace, { transform: [{ translateY }] }]}>
        <View style={[styles.gridBadge, { backgroundColor: bg }]}>
          <Icon size={24} color={tint} strokeWidth={2.5} />
        </View>
        <Text style={styles.gridTitle} numberOfLines={2}>
          {session.title}
        </Text>
        <Text style={styles.gridMeta}>{metaLine(session)}</Text>
      </Animated.View>
    </Pressable>
  );
}

// Nothing downloaded yet — point the student at the QR on-ramp. Tapping the
// card jumps straight to the Scanner (same destination as the header badge).
function EmptyShelf({ onScan }: { onScan: () => void }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyBadge}>
        <ScanLine size={34} color={colors.primary} strokeWidth={2.5} />
      </View>
      <Text style={styles.emptyTitle}>No sessions yet</Text>
      <Text style={styles.emptyBody}>
        Scan the QR code your teacher shares (or enter its code) to add a
        session and download it for offline use.
      </Text>
      <Pressable
        onPress={onScan}
        style={({ pressed }) => [styles.emptyCta, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
      >
        <QrCode size={18} color={colors.primary} strokeWidth={2.5} />
        <Text style={styles.emptyCtaLabel}>Scan a code</Text>
      </Pressable>
    </View>
  );
}

// Hard drop-shadow lip height (design offset y:4, no blur). Faked as a stacked
// layer because RN ignores shadowColor/Offset/Radius on Android — same approach
// as CTAButton / OptionCard. LIP = bento cards, SCAN_LIP = the QR badge.
const LIP = 4;
const SCAN_LIP = 4;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: spacing.xl - 4,
    paddingTop: spacing.sm,
    gap: 18,
  },

  // Header
  header: { gap: spacing.xs },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: fontSizes.heading,
    fontFamily: fonts.extraBold,
    color: colors.text,
  },
  // QR badge: orange face over a primaryDark lip. Wrapper height = 50 face +
  // SCAN_LIP so the ledge sits inside the header row.
  scanLip: {
    position: "absolute",
    left: 0,
    right: 0,
    top: SCAN_LIP,
    bottom: 0,
    borderRadius: radii.lg,
    backgroundColor: colors.primaryDark,
  },
  scanFace: {
    width: 50,
    height: 50,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SCAN_LIP,
  },
  subtitle: {
    fontSize: fontSizes.body,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
  },

  // Bento grid — a vertical stack of equal 2-up rows.
  grid: {
    gap: spacing.md,
  },
  gridRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  // Balances a lone trailing card so it keeps its half-width tile size instead
  // of stretching across the row.
  gridSpacer: { flex: 1 },
  // Stacked-layer card: the lip (border-colored block) sits LIP px below the
  // face, faking the design's hard 4px drop shadow (RN ignores shadow* on
  // Android). `flex: 1` widths the card in its row; row stretch + the face's
  // own `flex: 1` keep both cards equal height with the ledge at the bottom.
  cardWrapper: { flex: 1 },
  cardLip: {
    position: "absolute",
    left: 0,
    right: 0,
    top: LIP,
    bottom: 0,
    borderRadius: 20,
    backgroundColor: colors.border,
  },
  cardFace: {
    flex: 1,
    gap: spacing.md,
    backgroundColor: colors.bg,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 14,
    marginBottom: LIP,
  },
  gridBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  gridTitle: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: colors.text,
    lineHeight: 19,
  },
  gridMeta: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.textMuted,
  },

  // Empty shelf (nothing downloaded yet)
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl * 2,
  },
  emptyBadge: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: colors.primaryBg,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: fontSizes.title,
    fontFamily: fonts.extraBold,
    color: colors.text,
  },
  emptyBody: {
    fontSize: fontSizes.body,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 320,
  },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primaryBg,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
  emptyCtaLabel: {
    fontSize: 15,
    fontFamily: fonts.extraBold,
    color: colors.primary,
  },
});
