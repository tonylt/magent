import test from "node:test";
import assert from "node:assert/strict";

import {
  attentionReasonRank,
  draftMatchesTarget,
  freshnessLabel,
  groupTimelineIntoTurns,
  isActionable,
  rankAttention,
  timeAgo,
} from "./selectors.ts";
import type { Attention, TimelineEvent } from "./types.ts";

function attn(id: string, reason: Attention["reason"], createdAt: number): Attention {
  return { id, agentId: `ag-${id}`, workspaceId: "w1", reason, summary: id, createdAt, freshness: "live" };
}

test("attention ranks permission over error over finished", () => {
  assert.ok(attentionReasonRank("permission") > attentionReasonRank("error"));
  assert.ok(attentionReasonRank("error") > attentionReasonRank("finished"));
});

test("rankAttention orders by reason urgency then recency, without mutating input", () => {
  const input: Attention[] = [
    attn("finished-new", "finished", 1000),
    attn("perm-old", "permission", 10),
    attn("error-mid", "error", 500),
    attn("perm-new", "permission", 900),
  ];
  const ranked = rankAttention(input);
  assert.deepEqual(ranked.map((a) => a.id), ["perm-new", "perm-old", "error-mid", "finished-new"]);
  // input is untouched
  assert.equal(input[0].id, "finished-new");
});

test("actions are only allowed on live data", () => {
  assert.equal(isActionable("live"), true);
  assert.equal(isActionable("syncing"), false);
  assert.equal(isActionable("stale"), false);
});

test("freshness labels are explicit", () => {
  assert.equal(freshnessLabel("live"), "LIVE");
  assert.equal(freshnessLabel("syncing"), "SYNCING");
  assert.equal(freshnessLabel("stale"), "STALE");
});

test("a Draft only matches its bound Agent", () => {
  assert.equal(draftMatchesTarget({ agentId: "a1", text: "hi" }, "a1"), true);
  assert.equal(draftMatchesTarget({ agentId: "a1", text: "hi" }, "a2"), false);
  assert.equal(draftMatchesTarget(null, "a1"), false);
});

test("timeAgo renders compact glanceable units", () => {
  const now = 10_000_000;
  assert.equal(timeAgo(now - 5_000, now), "5s");
  assert.equal(timeAgo(now - 3 * 60_000, now), "3m");
  assert.equal(timeAgo(now - 2 * 3_600_000, now), "2h");
  assert.equal(timeAgo(now - 2 * 86_400_000, now), "2d");
});

function tl(id: string, kind: TimelineEvent["kind"], text: string, at = 0): TimelineEvent {
  return { id, agentId: "a1", at, kind, text };
}

test("groups a flat timeline into turns with collapsible steps and merged reply", () => {
  const turns = groupTimelineIntoTurns([
    tl("1", "user", "write the article"),
    tl("2", "reasoning", "planning"),
    tl("3", "tool", "edit-article"),
    tl("4", "assistant", "Here is the intro"),
    tl("5", "assistant", "and the body"),
    tl("6", "user", "make it shorter"),
    tl("7", "assistant", "Done"),
  ]);
  assert.equal(turns.length, 2);
  assert.equal(turns[0].user, "write the article");
  assert.equal(turns[0].steps.length, 2);
  assert.equal(turns[0].reply, "Here is the intro\n\nand the body");
  assert.equal(turns[1].user, "make it shorter");
  assert.equal(turns[1].reply, "Done");
});

test("timeline with no leading user still forms a turn", () => {
  const turns = groupTimelineIntoTurns([tl("1", "assistant", "hi"), tl("2", "error", "boom")]);
  assert.equal(turns.length, 1);
  assert.equal(turns[0].user, null);
  assert.equal(turns[0].reply, "hi");
  assert.equal(turns[0].notices.length, 1);
});
