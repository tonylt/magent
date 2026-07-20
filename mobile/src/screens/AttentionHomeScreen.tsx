import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AttentionCard } from "../components/AttentionCard";
import { FreshnessBadge } from "../components/FreshnessBadge";
import { getConnection, getRepository, subscribeConnection, subscribeData, type Connection } from "../data/instance";
import { rankAttention } from "../domain/selectors";
import type { AgentSession, Attention, HostSnapshot, Workspace } from "../domain/types";
import { colors, font, space } from "../theme";
import type { ScreenProps } from "../navigation";

function connectionLabel(connection: Connection): string {
  switch (connection.mode) {
    case "online":
      return connection.hostName;
    case "connecting":
      return "connecting…";
    case "error":
      return "connection error";
    case "mock":
    default:
      return "demo data";
  }
}

export function AttentionHomeScreen({ navigation }: ScreenProps<"Home">) {
  const [host, setHost] = useState<HostSnapshot | null>(null);
  const [attention, setAttention] = useState<Attention[]>([]);
  const [workspaces, setWorkspaces] = useState<Record<string, Workspace>>({});
  const [agents, setAgents] = useState<Record<string, AgentSession>>({});
  const [now, setNow] = useState(() => Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const [connection, setConnection] = useState<Connection>(() => getConnection());
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const repository = getRepository();
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
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  useEffect(() => subscribeConnection(() => {
    setConnection(getConnection());
    void load();
  }), [load]);

  useEffect(() => subscribeData(() => { void load(); }), [load]);

  const ranked = rankAttention(attention);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <View>
          <Text style={styles.eyebrow}>ATTENTION</Text>
          <Text style={styles.host}>{host ? host.hostName : connectionLabel(connection)}</Text>
        </View>
        <View style={styles.headerRight}>
          {host ? <FreshnessBadge freshness={host.freshness} /> : null}
          <Pressable onPress={() => navigation.navigate("Connect")} hitSlop={12}>
            <Text style={styles.link}>{connection.mode === "online" ? "HOST ›" : "CONNECT ›"}</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={ranked}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.accent} />}
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
        ListHeaderComponent={
          <Pressable style={styles.workspacesLink} onPress={() => navigation.navigate("Workspaces")}>
            <Text style={styles.workspacesText}>ALL WORKSPACES ›</Text>
          </Pressable>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>All clear</Text>
            <Text style={styles.emptyCopy}>
              {connection.mode === "error"
                ? connectionLabel(connection)
                : "No Agent session needs your attention."}
            </Text>
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
  list: { padding: space.lg, gap: space.sm },
  workspacesLink: { paddingBottom: space.sm },
  workspacesText: { color: colors.textDim, fontSize: font.size.sm, fontWeight: font.weight.bold, letterSpacing: 1 },
  empty: { alignItems: "center", paddingTop: space.xxl * 2, gap: space.sm },
  emptyTitle: { color: colors.text, fontSize: font.size.xl, fontWeight: font.weight.bold },
  emptyCopy: { color: colors.textDim, fontSize: font.size.md, textAlign: "center", paddingHorizontal: space.lg },
});
