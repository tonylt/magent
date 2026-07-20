import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { FreshnessBadge } from "../components/FreshnessBadge";
import { getRepository } from "../data/instance";
import { isActionable, timeAgo } from "../domain/selectors";
import type { AgentSession, HostSnapshot, TimelineEvent } from "../domain/types";
import { colors, font, radius, space, touchTarget } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ScreenProps } from "../navigation";

const kindColor: Record<TimelineEvent["kind"], string> = {
  user: colors.accent,
  assistant: colors.text,
  reasoning: colors.textFaint,
  tool: colors.textDim,
  todo: colors.finished,
  message: colors.text,
  error: colors.error,
  finished: colors.finished,
  permission: colors.permission,
};

const kindLabel: Record<TimelineEvent["kind"], string> = {
  user: "YOU",
  assistant: "AGENT",
  reasoning: "THINKING",
  tool: "TOOL",
  todo: "TODO",
  message: "MESSAGE",
  error: "ERROR",
  finished: "FINISHED",
  permission: "PERMISSION",
};

export function AgentScreen({ route, navigation }: ScreenProps<"Agent">) {
  const { agentId } = route.params;
  const insets = useSafeAreaInsets();
  const [agent, setAgent] = useState<AgentSession | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [host, setHost] = useState<HostSnapshot | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const repository = getRepository();
      const [nextAgent, nextEvents, nextHost] = await Promise.all([
        repository.getAgent(agentId),
        repository.getTimeline(agentId),
        repository.getHostSnapshot(),
      ]);
      setAgent(nextAgent);
      setEvents(nextEvents);
      setHost(nextHost);
      setNow(Date.now());
    } finally {
      setRefreshing(false);
    }
  }, [agentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const canAct = host ? isActionable(host.freshness) : false;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.accent} />}
      >
        <Text style={styles.title}>{agent?.title ?? agentId}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{agent ? `${agent.provider} · ${agent.model}` : ""}</Text>
          {host ? <FreshnessBadge freshness={host.freshness} /> : null}
        </View>
        {agent?.native ? <Text style={styles.readonly}>NATIVE SUBAGENT · READ-ONLY</Text> : null}

        <View style={styles.timeline}>
          {events.map((event) => (
            <View
              key={event.id}
              style={[
                styles.event,
                { borderLeftColor: kindColor[event.kind] },
                event.kind === "user" && styles.eventUser,
              ]}
            >
              <View style={styles.eventHead}>
                <Text style={[styles.kind, { color: kindColor[event.kind] }]}>{kindLabel[event.kind]}</Text>
                <Text style={styles.eventTime}>{timeAgo(event.at, now)}</Text>
              </View>
              {event.text ? (
                <Text style={[styles.eventText, event.kind === "reasoning" && styles.reasoningText]}>
                  {event.text}{event.truncated ? " …" : ""}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
        <Pressable
          disabled={!canAct}
          onPress={() => navigation.navigate("Composer", { agentId })}
          style={({ pressed }) => [styles.action, !canAct && styles.actionDisabled, pressed && styles.actionPressed]}
        >
          <Text style={[styles.actionText, !canAct && styles.actionTextDisabled]}>
            {canAct ? "FOLLOW UP" : "STALE — READ ONLY"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.sm, paddingBottom: space.xxl },
  title: { color: colors.text, fontSize: font.size.xl, fontWeight: font.weight.bold },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  meta: { color: colors.textDim, fontSize: font.size.sm },
  readonly: { color: colors.textFaint, fontSize: font.size.xs, fontWeight: font.weight.bold, letterSpacing: 1 },
  timeline: { marginTop: space.md, gap: space.sm },
  event: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    gap: space.xs,
  },
  eventUser: { backgroundColor: colors.surfaceRaised },
  eventHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  kind: { fontSize: font.size.xs, fontWeight: font.weight.bold, letterSpacing: 1.5 },
  eventText: { color: colors.text, fontSize: font.size.md, lineHeight: 22 },
  reasoningText: { color: colors.textDim, fontStyle: "italic" },
  eventTime: { color: colors.textFaint, fontSize: font.size.xs },
  footer: { padding: space.lg, borderTopWidth: 1, borderTopColor: colors.border },
  action: {
    minHeight: touchTarget,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  actionDisabled: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  actionPressed: { opacity: 0.85 },
  actionText: { color: colors.bg, fontSize: font.size.md, fontWeight: font.weight.bold, letterSpacing: 1 },
  actionTextDisabled: { color: colors.textFaint },
});
