import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { FreshnessBadge } from "../components/FreshnessBadge";
import { getRepository } from "../data/instance";
import { buildTimelineSegments, isActionable, timeAgo } from "../domain/selectors";
import type { TimelineSegment } from "../domain/selectors";
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

const COLLAPSIBLE: ReadonlySet<TimelineSegment["kind"]> = new Set(["reasoning"]);
const PREVIEW_LIMIT = 90;

function SegmentView({
  segment,
  now,
  expanded,
  onToggle,
}: {
  segment: TimelineSegment;
  now: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const color = kindColor[segment.kind];

  // Compact tool line.
  if (segment.kind === "tool") {
    return (
      <View style={styles.toolRow}>
        <Text style={styles.toolText} numberOfLines={1}>{`\u2699  ${segment.text}`}</Text>
      </View>
    );
  }

  // Collapsible reasoning (dim italic), collapsed to a preview by default.
  if (COLLAPSIBLE.has(segment.kind)) {
    const long = segment.text.length > PREVIEW_LIMIT;
    return (
      <Pressable style={styles.thinking} onPress={long ? onToggle : undefined}>
        <Text style={styles.thinkingLabel}>{`\u2726 THINKING${long ? (expanded ? "  \u25be" : "  \u25b8") : ""}`}</Text>
        <Text style={styles.thinkingText} numberOfLines={long && !expanded ? 2 : undefined}>
          {segment.text}
        </Text>
      </Pressable>
    );
  }

  const isUser = segment.kind === "user";
  return (
    <View style={[styles.bubble, { borderLeftColor: color }, isUser && styles.userBubble]}>
      <View style={styles.bubbleHead}>
        <Text style={[styles.label, isUser ? { color: colors.accent } : styles.agentLabel]}>
          {kindLabel[segment.kind]}
        </Text>
        <Text style={styles.time}>{timeAgo(segment.at, now)}</Text>
      </View>
      {segment.text ? <Text style={styles.bubbleText}>{segment.text}</Text> : null}
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
          {buildTimelineSegments(events).map((segment) => (
            <SegmentView
              key={segment.id}
              segment={segment}
              now={now}
              expanded={Boolean(expanded[segment.id])}
              onToggle={() => setExpanded((prev) => ({ ...prev, [segment.id]: !prev[segment.id] }))}
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
  timeline: { marginTop: space.md, gap: space.sm },
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
  thinking: { paddingHorizontal: space.md, paddingVertical: space.xs, gap: 2, marginLeft: space.xs },
  thinkingLabel: { color: colors.textFaint, fontSize: font.size.xs, fontWeight: font.weight.bold, letterSpacing: 1.5 },
  thinkingText: { color: colors.textFaint, fontSize: font.size.sm, lineHeight: 20, fontStyle: "italic" },
  toolRow: { paddingHorizontal: space.md, paddingVertical: 2, marginLeft: space.xs },
  toolText: { color: colors.textDim, fontSize: font.size.sm, fontFamily: font.mono },
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
