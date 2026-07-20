import { StyleSheet, Text, View } from "react-native";

import type { AttentionReason } from "../domain/types";
import { attentionReasonLabel } from "../domain/selectors";
import { colors, font, radius, space } from "../theme";

const reasonColor: Record<AttentionReason, string> = {
  permission: colors.permission,
  error: colors.error,
  finished: colors.finished,
};

export function ReasonPill({ reason }: { reason: AttentionReason }) {
  return (
    <View style={[styles.pill, { borderColor: reasonColor[reason] }]}>
      <Text style={[styles.text, { color: reasonColor[reason] }]}>{attentionReasonLabel(reason)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  text: { fontSize: font.size.xs, fontWeight: font.weight.bold, letterSpacing: 1 },
});
