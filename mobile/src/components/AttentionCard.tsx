import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Attention, Workspace } from "../domain/types";
import { timeAgo } from "../domain/selectors";
import { colors, font, radius, space, touchTarget } from "../theme";
import { FreshnessBadge } from "./FreshnessBadge";
import { ReasonPill } from "./ReasonPill";

export function AttentionCard({
  attention,
  workspace,
  agentTitle,
  now,
  onPress,
}: {
  attention: Attention;
  workspace?: Workspace;
  agentTitle?: string;
  now: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${attention.reason} on ${agentTitle ?? attention.agentId}`}
    >
      <View style={styles.topRow}>
        <ReasonPill reason={attention.reason} />
        <View style={styles.topRight}>
          <FreshnessBadge freshness={attention.freshness} />
          <Text style={styles.time}>{timeAgo(attention.createdAt, now)}</Text>
        </View>
      </View>
      <Text style={styles.summary} numberOfLines={2}>{attention.summary}</Text>
      <Text style={styles.meta} numberOfLines={1}>
        {(agentTitle ?? attention.agentId)}
        {workspace ? `  ·  ${workspace.name}` : ""}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: touchTarget,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.sm,
  },
  pressed: { backgroundColor: colors.surfaceRaised, borderColor: colors.accent },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  topRight: { flexDirection: "row", alignItems: "center", gap: space.md },
  time: { color: colors.textFaint, fontSize: font.size.xs },
  summary: { color: colors.text, fontSize: font.size.lg, fontWeight: font.weight.medium },
  meta: { color: colors.textDim, fontSize: font.size.sm },
});
