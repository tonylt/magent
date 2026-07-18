import test from "node:test";
import assert from "node:assert/strict";

import type { InputSource, SemanticCommand } from "../../../src/production/contracts.ts";
import { createProductionInputController } from "../../../src/production/input-controller.ts";

test("a keyboard release cannot finish a Rabbit hold", () => {
  const emitted: Array<{ command: SemanticCommand; source: InputSource }> = [];
  const controller = createProductionInputController({
    emit: (command, source) => emitted.push({ command, source }),
  });

  controller.handle({ type: "hold-start" }, "rabbit");
  controller.handle({ type: "hold-end" }, "keyboard");
  assert.deepEqual(emitted, [{ command: { type: "hold-start" }, source: "rabbit" }]);

  controller.handle({ type: "hold-end" }, "rabbit");
  assert.deepEqual(emitted.at(-1), { command: { type: "hold-end" }, source: "rabbit" });
  controller.dispose();
});

test("a keyboard release cannot clear a capped Rabbit hold latch", () => {
  let cap!: () => void;
  const emitted: Array<{ command: SemanticCommand; source: InputSource }> = [];
  const controller = createProductionInputController({
    emit: (command, source) => emitted.push({ command, source }),
    maxHoldMs: 30_000,
    clock: {
      now: () => 0,
      setTimeout: (callback) => { cap = callback; return 1 as unknown as ReturnType<typeof setTimeout>; },
      clearTimeout: () => {},
    },
  });
  controller.handle({ type: "hold-start" }, "rabbit");
  cap();
  controller.handle({ type: "hold-end" }, "keyboard");
  assert.equal(controller.handle({ type: "next" }, "keyboard"), false);
  controller.handle({ type: "hold-end" }, "rabbit");
  assert.equal(controller.handle({ type: "next" }, "keyboard"), true);
  controller.dispose();
});
