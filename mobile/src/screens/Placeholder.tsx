// Temporary placeholder used by every screen until the real UI lands.
// Shows the screen name + any params, and renders nav buttons passed in.
import { StyleSheet, Text, View, Pressable } from "react-native";
import { colors, spacing, fontSizes, radii } from "../theme";

type NavButton = { label: string; onPress: () => void };

export default function Placeholder({
  name,
  detail,
  buttons = [],
}: {
  name: string;
  detail?: string;
  buttons?: NavButton[];
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{name}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      <View style={styles.buttons}>
        {buttons.map((b) => (
          <Pressable
            key={b.label}
            style={styles.button}
            onPress={b.onPress}
          >
            <Text style={styles.buttonText}>{b.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  title: {
    fontSize: fontSizes.heading,
    fontWeight: "800",
    color: colors.text,
  },
  detail: {
    marginTop: spacing.sm,
    fontSize: fontSizes.body,
    color: colors.textSecondary,
  },
  buttons: {
    marginTop: spacing.xxl,
    gap: spacing.md,
    alignSelf: "stretch",
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: radii.md,
    alignItems: "center",
  },
  buttonText: {
    color: colors.bg,
    fontSize: fontSizes.base,
    fontWeight: "800",
  },
});
