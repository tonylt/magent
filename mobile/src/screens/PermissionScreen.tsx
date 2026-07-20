import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { getRepository } from "../data/instance";
import type { PermissionRequest } from "../domain/types";
import { colors, font, radius, space, touchTarget } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ScreenProps } from "../navigation";

export function PermissionScreen({ route, navigation }: ScreenProps<"Permission">) {
  const { permissionId } = route.params;
  const insets = useSafeAreaInsets();
  const [permission, setPermission] = useState<PermissionRequest | null>(null);

  useEffect(() => {
    void (async () => setPermission(await getRepository().getPermission(permissionId)))();
  }, [permissionId]);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>PERMISSION · READ-ONLY HANDOFF</Text>
        <Text style={styles.title}>{permission?.title ?? "Permission request"}</Text>
        <Text style={styles.detail}>{permission?.detail ?? ""}</Text>
        <View style={styles.note}>
          <Text style={styles.noteText}>
            This companion does not approve or deny. Continue in a trusted Paseo client to resolve it.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
        <Pressable style={styles.continueBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.continueText}>CONTINUE IN PASEO</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.md },
  eyebrow: { color: colors.permission, fontSize: font.size.xs, letterSpacing: 2, fontWeight: font.weight.bold },
  title: { color: colors.text, fontSize: font.size.xl, fontWeight: font.weight.bold },
  detail: { color: colors.textDim, fontSize: font.size.md, lineHeight: 24 },
  note: {
    marginTop: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
  },
  noteText: { color: colors.textDim, fontSize: font.size.sm, lineHeight: 22 },
  footer: { padding: space.lg, borderTopWidth: 1, borderTopColor: colors.border },
  continueBtn: {
    minHeight: touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  continueText: { color: colors.accent, fontSize: font.size.md, fontWeight: font.weight.bold, letterSpacing: 1 },
});
