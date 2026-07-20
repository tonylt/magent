import { StyleSheet, Text, View } from "react-native";

import type { Freshness } from "../domain/types";
import { freshnessLabel } from "../domain/selectors";
import { colors, font, radius, space } from "../theme";

const dotColor: Record<Freshness, string> = {
  live: colors.live,
  syncing: colors.syncing,
  stale: colors.stale,
};

export function FreshnessBadge({ freshness }: { freshness: Freshness }) {
  return (
    <View style={styles.badge}>
      <View style={[styles.dot, { backgroundColor: dotColor[freshness] }]} />
      <Text style={[styles.label, { color: dotColor[freshness] }]}>{freshnessLabel(freshness)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", gap: space.xs },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  label: { fontSize: font.size.xs, fontWeight: font.weight.bold, letterSpacing: 1 },
});
