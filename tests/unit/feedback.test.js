import test from "node:test";
import assert from "node:assert/strict";

import { createFeedback } from "../../demo/lib/feedback.js";

test("feedback degrades to a no-op without audio or vibration APIs", () => {
  const feedback = createFeedback({ host: { navigator: {} }, enabled: true });
  assert.doesNotThrow(() => {
    feedback.tick();
    feedback.blip();
    feedback.haptic();
    feedback.dispose();
  });
});

test("disabled feedback never vibrates or plays audio", () => {
  let vibrated = 0;
  let oscillators = 0;
  const host = {
    navigator: { vibrate: () => { vibrated += 1; } },
    AudioContext: function () { oscillators += 1; },
  };
  const feedback = createFeedback({ host, enabled: false });
  feedback.tick();
  assert.equal(vibrated, 0);
  assert.equal(oscillators, 0);
});

test("enabled feedback vibrates and starts a short oscillator", () => {
  const calls = { vibrate: [], oscillators: 0, started: 0 };
  const oscillator = {
    type: "",
    frequency: { value: 0 },
    connect: (node) => node,
    start: () => { calls.started += 1; },
    stop: () => {},
  };
  const gain = {
    gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
    connect: (node) => node,
  };
  const ctx = {
    state: "running",
    currentTime: 0,
    destination: {},
    createOscillator: () => { calls.oscillators += 1; return oscillator; },
    createGain: () => gain,
    resume: () => {},
    close: () => {},
  };
  const host = {
    navigator: { vibrate: (ms) => calls.vibrate.push(ms) },
    AudioContext: function () { return ctx; },
  };
  const feedback = createFeedback({ host, enabled: true });
  feedback.tick();
  assert.equal(calls.vibrate.length, 1);
  assert.equal(calls.oscillators, 1);
  assert.equal(calls.started, 1);
  feedback.dispose();
});
