import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { getRepository } from "../data/instance";
import type { AgentSession, Workspace } from "../domain/types";
import { colors, font, radius, space, touchTarget } from "../theme";
import type { ScreenProps } from "../navigation";

const statusColor: Record<Workspace["status"], string> = {
  attention: colors.accent,
  active: colors.live,
  idle: colors.textFaint,
};

const lifecycleColor: Record<AgentSession["lifecycle"], string> = {
  running: colors.live,
  waiting: colors.syncing,
  idle: colors.textFaint,
  error: colors.error,
  done: colors.finished,
};

export function WorkspacesScreen({ navigation }: ScreenProps<"Workspaces">) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [agents, setAgents] = useState<AgentSession[]>([]);

  useEffect(() => {
    void (async () => {
      setWorkspaces(await getRepository().listWorkspaces());
      setAgents(await getRepository().listAgents());
    })();
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {workspaces.map((workspace) => {
        const roots = agents.filter((a) => a.workspaceId === workspace.id && !a.parentAgentId);
        return (
          <View key={workspace.id} style={styles.group}>
            <View style={styles.groupHeader}>
              <View style={[styles.statusDot, { backgroundColor: statusColor[workspace.status] }]} />
              <Text style={styles.groupTitle}>{workspace.name}</Text>
              <Text style={styles.groupStatus}>{roots.length > 0 ? `${roots.length} · ` : ""}{workspace.status.toUpperCase()}</Text>
            </View>
            {roots.map((agent) => (
              <Pressable
                key={agent.id}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                onPress={() => navigation.navigate("Agent", { agentId: agent.id })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{agent.title}</Text>
                  <Text style={styles.rowMeta}>{agent.provider} · {agent.model}</Text>
                </View>
                <Text style={[styles.lifecycle, { color: lifecycleColor[agent.lifecycle] }]}>
                  {agent.lifecycle.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.xl },
  group: { gap: space.sm },
  groupHeader: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.xs },
  statusDot: { width: 10, height: 10, borderRadius: radius.pill },
  groupTitle: { color: colors.text, fontSize: font.size.lg, fontWeight: font.weight.bold, flex: 1 },
  groupStatus: { color: colors.textFaint, fontSize: font.size.xs, fontWeight: font.weight.bold, letterSpacing: 1 },
  row: {
    minHeight: touchTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  pressed: { backgroundColor: colors.surfaceRaised, borderColor: colors.accent },
  rowTitle: { color: colors.text, fontSize: font.size.md, fontWeight: font.weight.medium },
  rowMeta: { color: colors.textDim, fontSize: font.size.sm },
  lifecycle: { fontSize: font.size.xs, fontWeight: font.weight.bold, letterSpacing: 1 },
});
