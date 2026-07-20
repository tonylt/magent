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

export interface TimelineSegment {
  readonly id: string;
  readonly kind: TimelineKind;
  readonly text: string;
  readonly at: number;
}

const MERGEABLE: ReadonlySet<TimelineKind> = new Set(["assistant", "message", "reasoning"]);

/**
 * Ordered timeline segments for display: preserves chronological order (thinking,
 * tool calls, and output stay interleaved), merges consecutive same-kind chunks
 * (assistant/reasoning streaming), and drops re-emitted identical user prompts.
 */
export function buildTimelineSegments(events: readonly TimelineEvent[]): TimelineSegment[] {
  const segments: { id: string; kind: TimelineKind; text: string; at: number }[] = [];
  let lastUserText: string | null = null;
  for (const event of events) {
    if (event.kind === "user") {
      if (event.text === lastUserText) continue;
      lastUserText = event.text;
      segments.push({ id: event.id, kind: event.kind, text: event.text, at: event.at });
      continue;
    }
    const last = segments[segments.length - 1];
    if (MERGEABLE.has(event.kind) && last && last.kind === event.kind) {
      last.text = last.text ? `${last.text}\n\n${event.text}` : event.text;
      continue;
    }
    segments.push({ id: event.id, kind: event.kind, text: event.text, at: event.at });
  }
  return segments;
}
