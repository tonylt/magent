import test from "node:test";
import assert from "node:assert/strict";

import { createInitialProbeState, reduceProbeState } from "../../demo/lib/probe-store.js";

test("focus is bounded and view navigation is deterministic", () => {
  let state = createInitialProbeState({ itemCount: 3 });
  state = reduceProbeState(state, { type: "previous" });
  assert.equal(state.focus, 0);
  state = reduceProbeState(state, { type: "next" });
  state = reduceProbeState(state, { type: "next" });
  state = reduceProbeState(state, { type: "next" });
  assert.equal(state.focus, 2);
  state = reduceProbeState(state, { type: "select" });
  assert.equal(state.view, "transport");
  state = reduceProbeState(state, { type: "back" });
  assert.equal(state.view, "home");
  assert.equal(state.focus, 2);
});

test("selecting the UAT item routes to the uat view and back returns home", () => {
  let state = createInitialProbeState({ itemCount: 4 });
  state = reduceProbeState(state, { type: "next" });
  state = reduceProbeState(state, { type: "next" });
  state = reduceProbeState(state, { type: "next" });
  assert.equal(state.focus, 3);
  state = reduceProbeState(state, { type: "select" });
  assert.equal(state.view, "uat");
  // Wheel navigation inside uat is handled outside the reducer, so it is a no-op here.
  const afterNext = reduceProbeState(state, { type: "next" });
  assert.equal(afterNext.view, "uat");
  assert.equal(afterNext.focus, 3);
  state = reduceProbeState(state, { type: "back" });
  assert.equal(state.view, "home");
  assert.equal(state.focus, 3);
});

test("home item routing stays deterministic across all four items", () => {
  const target = (focus) => {
    let state = createInitialProbeState({ itemCount: 4 });
    state = reduceProbeState(state, { type: "focus-at", focus });
    return reduceProbeState(state, { type: "select" }).view;
  };
  assert.equal(target(0), "diagnostics");
  assert.equal(target(1), "diagnostics");
  assert.equal(target(2), "transport");
  assert.equal(target(3), "uat");
});

test("voice review never sends automatically and accept clears the transcript", () => {
  let state = createInitialProbeState({ itemCount: 3 });
  state = reduceProbeState(state, { type: "voice-started" });
  assert.equal(state.view, "voice");
  assert.equal(state.recording, true);
  state = reduceProbeState(state, { type: "voice-transcribing" });
  state = reduceProbeState(state, { type: "voice-transcript", transcript: "Review this first" });
  assert.equal(state.view, "composer");
  assert.equal(state.transcript, "Review this first");
  assert.equal(state.acceptedTranscript, false);
  state = reduceProbeState(state, { type: "select" });
  assert.equal(state.view, "home");
  assert.equal(state.transcript, "");
  assert.equal(state.acceptedTranscript, true);
});

test("voice interruption returns to a recoverable home state", () => {
  let state = createInitialProbeState({ itemCount: 3 });
  state = reduceProbeState(state, { type: "voice-started" });
  state = reduceProbeState(state, { type: "voice-interrupted", reason: "hidden" });
  assert.equal(state.view, "home");
  assert.equal(state.recording, false);
  assert.equal(state.voiceFailure, "hidden");
});
