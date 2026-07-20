// Pure selectors for the mobile companion. No React Native imports, so these are
// unit-testable with plain Node. They encode the differentiation rules: attention
// ranking, freshness trust, and target-bound Draft safety.

import type {
  Attention,
  AttentionReason,
  Draft,
  Freshness,
  TimelineEvent,
  TimelineKind,
} from "./types";

/** Higher rank = more urgent. Permission blocks work, error needs attention, then finished. */
export function attentionReasonRank(reason: AttentionReason): number {
  switch (reason) {
    case "permission":
      return 3;
    case "error":
      return 2;
    case "finished":
      return 1;
    default:
      return 0;
  }
}

/**
 * Rank Attention for the flagship Home: by reason urgency, then most recent first.
 * Stable and non-mutating.
 */
export function rankAttention(items: readonly Attention[]): Attention[] {
  return [...items].sort((a, b) => {
    const byReason = attentionReasonRank(b.reason) - attentionReasonRank(a.reason);
    if (byReason !== 0) return byReason;
    return b.createdAt - a.createdAt;
  });
}

export function freshnessLabel(freshness: Freshness): string {
  switch (freshness) {
    case "live":
      return "LIVE";
    case "syncing":
      return "SYNCING";
    case "stale":
      return "STALE";
    default:
      return "STALE";
  }
}

/** Controlled actions (Follow-up, Stop) are only allowed on live data. */
export function isActionable(freshness: Freshness): boolean {
  return freshness === "live";
}

export function attentionReasonLabel(reason: AttentionReason): string {
  switch (reason) {
    case "permission":
      return "PERMISSION";
    case "error":
      return "ERROR";
    case "finished":
      return "FINISHED";
    default:
      return "";
  }
}

/**
 * A Draft may only be edited/sent against its bound Agent. Prevents sending a Draft
 * composed for one Agent into another (no wrong-target sends).
 */
export function draftMatchesTarget(draft: Draft | null, agentId: string): boolean {
  return draft !== null && draft.agentId === agentId;
}

/** Relative "time ago" label for glanceable recency. */
export function timeAgo(fromMs: number, nowMs: number): string {
  const seconds = Math.max(0, Math.round((nowMs - fromMs) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export interface TimelineTurnStep {
  readonly id: string;
  readonly kind: TimelineKind;
  readonly text: string;
}

/**
 * One conversational turn: the user's prompt, the agent's intermediate steps
 * (reasoning / tool calls / todos, collapsible), the merged final reply, and any
 * notices (errors / permissions / finished markers).
 */
export interface TimelineTurn {
  readonly id: string;
  readonly at: number;
  user: string | null;
  readonly steps: TimelineTurnStep[];
  reply: string;
  readonly notices: TimelineEvent[];
}

const STEP_KINDS: ReadonlySet<TimelineKind> = new Set(["reasoning", "tool", "todo"]);
const REPLY_KINDS: ReadonlySet<TimelineKind> = new Set(["assistant", "message"]);

/** Group a flat timeline into turns. A `user` event starts a new turn; an identical
 * consecutive prompt (daemons sometimes re-emit it) keeps the current turn. */
export function groupTimelineIntoTurns(events: readonly TimelineEvent[]): TimelineTurn[] {
  const turns: TimelineTurn[] = [];
  for (const event of events) {
    if (event.kind === "user") {
      const last = turns[turns.length - 1];
      if (last && last.user === event.text) continue;
      turns.push({ id: event.id, at: event.at, user: event.text, steps: [], reply: "", notices: [] });
      continue;
    }
    let turn = turns[turns.length - 1];
    if (!turn) {
      turn = { id: event.id, at: event.at, user: null, steps: [], reply: "", notices: [] };
      turns.push(turn);
    }
    if (STEP_KINDS.has(event.kind)) {
      turn.steps.push({ id: event.id, kind: event.kind, text: event.text });
    } else if (REPLY_KINDS.has(event.kind)) {
      turn.reply = turn.reply ? `${turn.reply}\n\n${event.text}` : event.text;
    } else {
      turn.notices.push(event);
    }
  }
  return turns;
}
