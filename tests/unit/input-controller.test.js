import test from "node:test";
import assert from "node:assert/strict";

import { createInputController } from "../../demo/lib/input-controller.js";
import { createFakeClock } from "./fake-clock.js";

function setup(options = {}) {
  const clock = createFakeClock();
  const emitted = [];
  const ignored = [];
  const controller = createInputController({
    emit: (event) => emitted.push(event),
    onIgnored: (event) => ignored.push(event),
    clock,
    minHoldMs: 250,
    maxHoldMs: 30_000,
    lateClickSuppressionMs: 500,
    ...options,
  });
  return { clock, emitted, ignored, controller };
}

test("passes wheel, select, and back as semantic commands", () => {
  const { controller, emitted } = setup();
  controller.handle("previous", "rabbit");
  controller.handle("next", "keyboard");
  controller.handle("select", "touch");
  controller.handle("back", "keyboard");
  assert.deepEqual(emitted.map(({ type, source }) => ({ type, source })), [
    { type: "previous", source: "rabbit" },
    { type: "next", source: "keyboard" },
    { type: "select", source: "touch" },
    { type: "back", source: "keyboard" },
  ]);
});

test("consumes a hold, ignores duplicate edges, and suppresses one trailing click", () => {
  const { clock, controller, emitted, ignored } = setup();
  controller.handle("hold-start", "rabbit");
  controller.handle("hold-start", "rabbit");
  controller.handle("select", "rabbit");
  clock.advance(400);
  controller.handle("hold-end", "rabbit");
  controller.handle("hold-end", "rabbit");
  controller.handle("select", "rabbit");
  controller.handle("select", "rabbit");

  assert.deepEqual(emitted.map((event) => event.type), ["hold-start", "hold-end", "select"]);
  assert.equal(emitted[1].durationMs, 400);
  assert.equal(emitted[1].tooShort, false);
  assert.deepEqual(ignored.map(({ reason }) => reason), [
    "duplicate-hold-start",
    "hold-consumed",
    "orphan-hold-end",
    "trailing-click",
  ]);
});

test("marks a short hold without guessing the firmware hold threshold", () => {
  const { clock, controller, emitted } = setup();
  controller.handle("hold-start", "rabbit");
  clock.advance(120);
  controller.handle("hold-end", "rabbit");
  assert.equal(emitted[1].type, "hold-end");
  assert.equal(emitted[1].tooShort, true);
  assert.equal(emitted[1].durationMs, 120);
});

test("ends capture at the recording limit and safely interrupts on lifecycle loss", () => {
  const first = setup();
  first.controller.handle("hold-start", "rabbit");
  first.clock.advance(30_000);
  assert.deepEqual(first.emitted.map((event) => event.type), ["hold-start", "hold-limit"]);
  assert.equal(first.clock.pendingTimers(), 0);

  const second = setup();
  second.controller.handle("hold-start", "keyboard");
  second.clock.advance(1_000);
  second.controller.interrupt("hidden");
  assert.deepEqual(second.emitted.map((event) => event.type), ["hold-start", "hold-interrupted"]);
  assert.equal(second.emitted[1].reason, "hidden");
  assert.equal(second.clock.pendingTimers(), 0);
});

test("expires trailing-click suppression without swallowing a later deliberate click", () => {
  const { clock, controller, emitted } = setup();
  controller.handle("hold-start", "rabbit");
  clock.advance(400);
  controller.handle("hold-end", "rabbit");
  clock.advance(501);
  controller.handle("select", "rabbit");
  assert.deepEqual(emitted.map((event) => event.type), ["hold-start", "hold-end", "select"]);
});
