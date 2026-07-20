import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { AttentionCard } from "../components/AttentionCard";
import { FreshnessBadge } from "../components/FreshnessBadge";
import { repository } from "../data/instance";
import { rankAttention } from "../domain/selectors";
import type { AgentSession, Attention, HostSnapshot, Workspace } from "../domain/types";
import { colors, font, space } from "../theme";
import type { ScreenProps } from "../navigation";

export function AttentionHomeScreen({ navigation }: ScreenProps<"Home">) {
  const [host, setHost] = useState<HostSnapshot | null>(null);
  const [attention, setAttention] = useState<Attention[]>([]);
  const [workspaces, setWorkspaces] = useState<Record<string, Workspace>>({});
  const [agents, setAgents] = useState<Record<string, AgentSession>>({});
  const [now, setNow] = useState(() => Date.now());
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const [snapshot, items, workspaceList, agentList] = await Promise.all([
      repository.getHostSnapshot(),
      repository.listAttention(),
      repository.listWorkspaces(),
      repository.listAgents(),
    ]);
    setHost(snapshot);
    setAttention(items);
    setWorkspaces(Object.fromEntries(workspaceList.map((w) => [w.id, w])));
    setAgents(Object.fromEntries(agentList.map((a) => [a.id, a])));
    setNow(Date.now());
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const ranked = rankAttention(attention);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>ATTENTION</Text>
          <Text style={styles.host}>{host ? host.hostName : "…"}</Text>
        </View>
        <View style={styles.headerRight}>
          {host ? <FreshnessBadge freshness={host.freshness} /> : null}
          <Pressable onPress={() => navigation.navigate("Workspaces")} hitSlop={12}>
            <Text style={styles.link}>WORKSPACES ›</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={ranked}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.accent} />
        }
        renderItem={({ item }) => (
          <AttentionCard
            attention={item}
            workspace={workspaces[item.workspaceId]}
            agentTitle={agents[item.agentId]?.title}
            now={now}
            onPress={() =>
              item.reason === "permission"
                ? navigation.navigate("Permission", { permissionId: item.id })
                : navigation.navigate("Agent", { agentId: item.agentId })
            }
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>All clear</Text>
            <Text style={styles.emptyCopy}>No Agent session needs your attention.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.md,
  },
  eyebrow: { color: colors.textFaint, fontSize: font.size.xs, letterSpacing: 2, fontWeight: font.weight.bold },
  host: { color: colors.text, fontSize: font.size.xl, fontWeight: font.weight.bold },
  headerRight: { alignItems: "flex-end", gap: space.xs },
  link: { color: colors.accent, fontSize: font.size.sm, fontWeight: font.weight.bold },
  list: { padding: space.lg, gap: space.md },
  empty: { alignItems: "center", paddingTop: space.xxl * 2, gap: space.sm },
  emptyTitle: { color: colors.text, fontSize: font.size.xl, fontWeight: font.weight.bold },
  emptyCopy: { color: colors.textDim, fontSize: font.size.md },
});
