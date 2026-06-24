// ============================================================================
// QR SCANNER  (design.pen → 02 QR Scanner / X5y6MQ)
// ----------------------------------------------------------------------------
// The live on-ramp: point the camera at a session QR → resolve it to a known
// session → jump straight into its Intro. Full-bleed camera under a dark scrim,
// a custom top bar (close · title · torch), a 260px orange-bracket reticle with
// a sweeping scan line, and a manual-code fallback.
//
// REAL-DATA ONLY: a code only opens a session that actually exists in
// `listSessions()` — we never fabricate one. A scanned/typed value is parsed to
// a sessionId (bare code or the last path segment of a tuwon link) and matched
// against the real catalog; an unknown code says so instead of dead-ending.
//
// We `replace` rather than `navigate` so the camera screen leaves the back
// stack — backing out of the Intro returns to the Library, not the viewfinder.
//
// PERMISSION + FALLBACK: camera scanning is device-only (an emulator has no real
// camera to read a QR), so the "Enter code manually" sheet is both the design's
// fallback AND the path that's verifiable without hardware. If the camera
// permission is denied we still surface manual entry so it's never a dead end.
// ============================================================================
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import { X, Flashlight, Download, Keyboard, Camera } from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, fonts, fontSizes, radii } from "../theme";
import { listSessions, type SessionSummary } from "../data/loader";
import { CTAButton } from "../components";

type Props = NativeStackScreenProps<RootStackParamList, "Scanner">;

// Dark-overlay palette — local to this screen (the app theme is a light palette;
// these are the design's scrim/glass tones over the camera feed). Hex8 = alpha.
const SCANNER = {
  bg: "#0E0E12", // base behind the feed (shown before the camera mounts)
  scrim: "#0B0B0FAB", // dim layer over the feed for contrast
  glass: "#FFFFFF1F", // top-bar torch / searching pill
  glassFaint: "#FFFFFF12", // reticle interior tint
  glassBtn: "#FFFFFF14", // manual-entry button fill
  glassBorder: "#FFFFFF5C", // manual-entry button border
  textStrong: "#FFFFFFE0", // instruction line
  textSoft: "#FFFFFFCC", // offline-info line
} as const;

const RETICLE = 260; // reticle box (design 260×260)
const BRACKET = 46; // corner bracket length

// Turn a scanned/typed value into a candidate session code: a bare code, or the
// last non-empty path segment of a link (tuwon://session/demo-quiz, https://…/s/demo-quiz).
function extractCode(raw: string): string {
  const trimmed = raw.trim();
  const beforeQuery = trimmed.split(/[?#]/)[0];
  const segments = beforeQuery.split("/").filter(Boolean);
  return segments[segments.length - 1] || trimmed;
}

export default function ScannerScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [torch, setTorch] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [scanNote, setScanNote] = useState<string | null>(null);

  // Guards a single navigation: once a valid code fires we don't want the
  // camera's repeated onBarcodeScanned to push the Intro twice.
  const handled = useRef(false);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    listSessions().then(setSessions);
  }, []);

  useEffect(() => {
    return () => {
      if (noteTimer.current) clearTimeout(noteTimer.current);
    };
  }, []);

  // Match a raw value against the REAL catalog; null if it's not a known session.
  const resolve = useCallback(
    (raw: string): string | null => {
      const code = extractCode(raw).toLowerCase();
      const match = sessions.find((s) => s.sessionId.toLowerCase() === code);
      return match ? match.sessionId : null;
    },
    [sessions]
  );

  const openSession = useCallback(
    (sessionId: string) => {
      handled.current = true;
      navigation.replace("Intro", { sessionId });
    },
    [navigation]
  );

  const onBarcodeScanned = useCallback(
    ({ data }: BarcodeScanningResult) => {
      if (handled.current) return;
      const sessionId = resolve(data);
      if (sessionId) {
        openSession(sessionId);
        return;
      }
      // Unknown code: nudge the user, then re-arm so they can try another.
      handled.current = true;
      setScanNote("That code isn't a tuwon session. Try another.");
      if (noteTimer.current) clearTimeout(noteTimer.current);
      noteTimer.current = setTimeout(() => {
        handled.current = false;
        setScanNote(null);
      }, 2200);
    },
    [resolve, openSession]
  );

  const submitManual = () => {
    const sessionId = resolve(manualCode);
    if (!sessionId) {
      setManualError("We couldn't find a session for that code.");
      return;
    }
    setManualOpen(false);
    openSession(sessionId);
  };

  const openManual = () => {
    setManualCode("");
    setManualError(null);
    setManualOpen(true);
  };

  // Permission still resolving — keep the dark canvas, no flash of content.
  if (!permission) {
    return <View style={styles.screen} />;
  }

  return (
    <View style={styles.screen}>
      {/* Live camera — only mounted while focused (one preview at a time) and
          only once granted. Otherwise the bare dark backdrop shows through. */}
      {permission.granted && isFocused && (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={onBarcodeScanned}
        />
      )}
      <View style={[StyleSheet.absoluteFill, styles.scrim]} />

      {/* Overlay chrome */}
      <View style={[styles.overlay, { paddingTop: insets.top }]}>
        <TopBar
          torch={torch}
          torchEnabled={permission.granted}
          onClose={() => navigation.goBack()}
          onToggleTorch={() => setTorch((t) => !t)}
        />

        {permission.granted ? (
          <ReticleArea note={scanNote} />
        ) : (
          <PermissionGate
            canAskAgain={permission.canAskAgain}
            onRequest={requestPermission}
          />
        )}

        <BottomPanel
          paddingBottom={insets.bottom + spacing.xl}
          onManual={openManual}
        />
      </View>

      <ManualEntrySheet
        visible={manualOpen}
        code={manualCode}
        error={manualError}
        onChange={(t) => {
          setManualCode(t);
          if (manualError) setManualError(null);
        }}
        onSubmit={submitManual}
        onClose={() => setManualOpen(false)}
      />
    </View>
  );
}

// ── Top bar: close · title · torch ──────────────────────────────────────────
function TopBar({
  torch,
  torchEnabled,
  onClose,
  onToggleTorch,
}: {
  torch: boolean;
  torchEnabled: boolean;
  onClose: () => void;
  onToggleTorch: () => void;
}) {
  return (
    <View style={styles.topBar}>
      <Pressable
        onPress={onClose}
        hitSlop={10}
        accessibilityLabel="Close scanner"
        accessibilityRole="button"
      >
        <X size={28} color="#FFFFFF" strokeWidth={2.5} />
      </Pressable>
      <Text style={styles.topTitle}>Scan QR Code</Text>
      <Pressable
        onPress={onToggleTorch}
        disabled={!torchEnabled}
        hitSlop={10}
        accessibilityLabel="Toggle flashlight"
        accessibilityRole="button"
        style={[
          styles.torch,
          torch && styles.torchOn,
          !torchEnabled && styles.torchDisabled,
        ]}
      >
        <Flashlight
          size={20}
          color={torch ? colors.text : "#FFFFFF"}
          strokeWidth={2.5}
        />
      </Pressable>
    </View>
  );
}

// ── Reticle: orange brackets + sweeping scan line + status pill ──────────────
function ReticleArea({ note }: { note: string | null }) {
  // Scan line sweeps top→bottom inside the reticle, looping (native driver).
  const sweep = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(sweep, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [sweep]);

  const translateY = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [16, RETICLE - 16],
  });

  return (
    <View style={styles.reticleArea}>
      <View style={styles.reticle}>
        <View style={[styles.bracket, styles.bracketTL]} />
        <View style={[styles.bracket, styles.bracketTR]} />
        <View style={[styles.bracket, styles.bracketBL]} />
        <View style={[styles.bracket, styles.bracketBR]} />
        <Animated.View style={[styles.scanLine, { transform: [{ translateY }] }]} />
      </View>

      <Text style={styles.instruction}>
        Point your camera at the QR code your teacher is sharing.
      </Text>

      <View style={styles.searching}>
        {note ? (
          <Text style={styles.searchingText}>{note}</Text>
        ) : (
          <>
            <View style={styles.searchingDot} />
            <Text style={styles.searchingText}>Searching for a code…</Text>
          </>
        )}
      </View>
    </View>
  );
}

// ── Permission gate (camera denied / not yet asked) ─────────────────────────
function PermissionGate({
  canAskAgain,
  onRequest,
}: {
  canAskAgain: boolean;
  onRequest: () => void;
}) {
  return (
    <View style={styles.reticleArea}>
      <View style={styles.permBadge}>
        <Camera size={40} color="#FFFFFF" strokeWidth={2.5} />
      </View>
      <Text style={styles.instruction}>
        {canAskAgain
          ? "tuwon needs camera access to scan a session QR code."
          : "Camera access is off. Enable it in Settings, or enter a code by hand below."}
      </Text>
      <CTAButton
        label={canAskAgain ? "ALLOW CAMERA" : "OPEN SETTINGS"}
        fullWidth={false}
        onPress={canAskAgain ? onRequest : () => Linking.openSettings()}
      />
    </View>
  );
}

// ── Bottom panel: offline note + manual-entry button ────────────────────────
function BottomPanel({
  paddingBottom,
  onManual,
}: {
  paddingBottom: number;
  onManual: () => void;
}) {
  return (
    <View style={[styles.bottomPanel, { paddingBottom }]}>
      <View style={styles.infoRow}>
        <Download size={18} color={colors.primary} strokeWidth={2.5} />
        <Text style={styles.infoText}>Sessions download for offline use</Text>
      </View>
      <Pressable
        onPress={onManual}
        style={({ pressed }) => [styles.manualBtn, pressed && styles.manualBtnPressed]}
        accessibilityRole="button"
      >
        <Keyboard size={18} color="#FFFFFF" strokeWidth={2.5} />
        <Text style={styles.manualLabel}>Enter code manually</Text>
      </Pressable>
    </View>
  );
}

// ── Manual entry sheet ──────────────────────────────────────────────────────
function ManualEntrySheet({
  visible,
  code,
  error,
  onChange,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  code: string;
  error: string | null;
  onChange: (t: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Lift the bottom sheet above the keyboard (autoFocus opens it
          immediately): padding on iOS, height on Android. */}
      <KeyboardAvoidingView
        style={styles.sheetAvoider}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable style={styles.sheetBackdrop} onPress={onClose}>
          {/* Inner press is swallowed so tapping the card doesn't dismiss it. */}
          <Pressable
            style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}
            onPress={() => {}}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Enter session code</Text>
            <Text style={styles.sheetSubtitle}>
              Type the code your teacher shared to open the session.
            </Text>
            <TextInput
              style={[styles.input, error && styles.inputError]}
              value={code}
              onChangeText={onChange}
              placeholder="e.g. demo-quiz"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              returnKeyType="go"
              onSubmitEditing={onSubmit}
            />
            {error && <Text style={styles.sheetError}>{error}</Text>}
            <CTAButton
              label="OPEN SESSION"
              disabled={code.trim().length === 0}
              onPress={onSubmit}
            />
            <Pressable onPress={onClose} hitSlop={8} style={styles.cancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: SCANNER.bg },
  scrim: { backgroundColor: SCANNER.scrim },
  overlay: { flex: 1 },

  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    paddingHorizontal: 18,
  },
  topTitle: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: "#FFFFFF",
  },
  torch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SCANNER.glass,
    alignItems: "center",
    justifyContent: "center",
  },
  torchOn: { backgroundColor: "#FFFFFF" },
  torchDisabled: { opacity: 0.4 },

  // Reticle area (also hosts the permission gate)
  reticleArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 30,
    paddingHorizontal: spacing.xl,
  },
  reticle: {
    width: RETICLE,
    height: RETICLE,
    borderRadius: 32,
    backgroundColor: SCANNER.glassFaint,
    overflow: "hidden",
  },
  bracket: {
    position: "absolute",
    width: BRACKET,
    height: BRACKET,
    borderColor: colors.primary,
  },
  bracketTL: {
    top: 0,
    left: 0,
    borderTopWidth: 5,
    borderLeftWidth: 5,
    borderTopLeftRadius: 16,
  },
  bracketTR: {
    top: 0,
    right: 0,
    borderTopWidth: 5,
    borderRightWidth: 5,
    borderTopRightRadius: 16,
  },
  bracketBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
    borderBottomLeftRadius: 16,
  },
  bracketBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 5,
    borderRightWidth: 5,
    borderBottomRightRadius: 16,
  },
  scanLine: {
    position: "absolute",
    left: 18,
    right: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
    opacity: 0.9,
    // Soft orange glow (iOS shadow; Android elevation gives a faint lift).
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 12,
    elevation: 6,
  },
  instruction: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: SCANNER.textStrong,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 300,
  },
  searching: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: SCANNER.glass,
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 15,
  },
  searchingDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.primary,
  },
  searchingText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: "#FFFFFF",
  },

  // Permission gate
  permBadge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: SCANNER.glass,
    alignItems: "center",
    justifyContent: "center",
  },

  // Bottom panel
  bottomPanel: {
    alignItems: "center",
    gap: spacing.lg,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  infoText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: SCANNER.textSoft,
  },
  manualBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    alignSelf: "stretch",
    backgroundColor: SCANNER.glassBtn,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: SCANNER.glassBorder,
    paddingVertical: 15,
    paddingHorizontal: 22,
  },
  manualBtnPressed: { opacity: 0.7 },
  manualLabel: {
    fontSize: 15,
    fontFamily: fonts.extraBold,
    color: "#FFFFFF",
  },

  // Manual entry sheet
  sheetAvoider: { flex: 1 },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "#00000080",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  sheetTitle: {
    fontSize: fontSizes.title,
    fontFamily: fonts.extraBold,
    color: colors.text,
  },
  sheetSubtitle: {
    fontSize: fontSizes.body,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    lineHeight: 21,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    fontSize: fontSizes.base,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  inputError: { borderColor: colors.red },
  sheetError: {
    fontSize: fontSizes.caption,
    fontFamily: fonts.bold,
    color: colors.incorrectText,
  },
  cancel: { alignSelf: "center", paddingVertical: spacing.sm },
  cancelText: {
    fontSize: fontSizes.body,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
  },
});
