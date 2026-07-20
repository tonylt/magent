import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { FreshnessBadge } from "../components/FreshnessBadge";
import { getRepository } from "../data/instance";
import { groupTimelineIntoTurns, isActionable, timeAgo } from "../domain/selectors";
import type { TimelineTurn } from "../domain/selectors";
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

function stepsSummary(steps: TimelineTurn["steps"]): string {
  const think = steps.filter((s) => s.kind === "reasoning").length;
  const tools = steps.filter((s) => s.kind === "tool").length;
  const todos = steps.filter((s) => s.kind === "todo").length;
  const parts: string[] = [];
  if (think) parts.push(`${think} thinking`);
  if (tools) parts.push(`${tools} tool${tools > 1 ? "s" : ""}`);
  if (todos) parts.push(`${todos} todo${todos > 1 ? "s" : ""}`);
  return parts.length > 0 ? parts.join(" · ") : `${steps.length} steps`;
}

function TurnCard({
  turn,
  now,
  expanded,
  onToggle,
}: {
  turn: TimelineTurn;
  now: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.turn}>
      {turn.user ? (
        <View style={[styles.bubble, styles.userBubble]}>
          <View style={styles.bubbleHead}>
            <Text style={[styles.label, { color: colors.accent }]}>YOU</Text>
            <Text style={styles.time}>{timeAgo(turn.at, now)}</Text>
          </View>
          <Text style={styles.bubbleText}>{turn.user}</Text>
        </View>
      ) : null}

      {turn.steps.length > 0 ? (
        <View style={styles.steps}>
          <Pressable style={styles.stepsHeader} onPress={onToggle} hitSlop={8}>
            <Text style={styles.stepsSummary}>{expanded ? "▾" : "▸"}  {stepsSummary(turn.steps)}</Text>
          </Pressable>
          {expanded
            ? turn.steps.map((step) => (
                <View key={step.id} style={styles.step}>
                  <Text style={[styles.stepKind, { color: kindColor[step.kind] }]}>{kindLabel[step.kind]}</Text>
                  <Text style={styles.stepText}>{step.text}</Text>
                </View>
              ))
            : null}
        </View>
      ) : null}

      {turn.reply ? (
        <View style={[styles.bubble, { borderLeftColor: colors.text }]}>
          <Text style={[styles.label, styles.agentLabel]}>AGENT</Text>
          <Text style={styles.bubbleText}>{turn.reply}</Text>
        </View>
      ) : null}

      {turn.notices.map((notice) => (
        <View key={notice.id} style={[styles.bubble, { borderLeftColor: kindColor[notice.kind] }]}>
          <View style={styles.bubbleHead}>
            <Text style={[styles.label, { color: kindColor[notice.kind] }]}>{kindLabel[notice.kind]}</Text>
            <Text style={styles.time}>{timeAgo(notice.at, now)}</Text>
          </View>
          {notice.text ? <Text style={styles.bubbleText}>{notice.text}</Text> : null}
        </View>
      ))}
    </View>
  );
}

export function AgentScreen({ route, navigation }: ScreenProps<"Agent">) {
  const { agentId } = route.params;
  const insets = useSafeAreaInsets();
  const [agent, setAgent] = useState<AgentSession | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [host, setHost] = useState<HostSnapshot | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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
          {groupTimelineIntoTurns(events).map((turn) => (
            <TurnCard
              key={turn.id}
              turn={turn}
              now={now}
              expanded={Boolean(expanded[turn.id])}
              onToggle={() => setExpanded((prev) => ({ ...prev, [turn.id]: !prev[turn.id] }))}
            />
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
  timeline: { marginTop: space.md, gap: space.md },
  turn: { gap: space.xs },
  bubble: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: colors.border,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    gap: space.xs,
  },
  userBubble: { backgroundColor: colors.surfaceRaised, borderLeftColor: colors.accent },
  bubbleHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { fontSize: font.size.xs, fontWeight: font.weight.bold, letterSpacing: 1.5 },
  agentLabel: { color: colors.textDim },
  bubbleText: { color: colors.text, fontSize: font.size.md, lineHeight: 22 },
  time: { color: colors.textFaint, fontSize: font.size.xs },
  steps: { gap: space.xs },
  stepsHeader: { paddingVertical: space.xs, paddingHorizontal: space.sm, alignSelf: "flex-start" },
  stepsSummary: { color: colors.textFaint, fontSize: font.size.sm, fontWeight: font.weight.medium, letterSpacing: 0.5 },
  step: {
    marginLeft: space.md,
    paddingLeft: space.md,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    gap: 2,
    paddingVertical: space.xs,
  },
  stepKind: { fontSize: font.size.xs, fontWeight: font.weight.bold, letterSpacing: 1 },
  stepText: { color: colors.textDim, fontSize: font.size.sm, lineHeight: 20 },
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
