import test from "node:test";
import assert from "node:assert/strict";

import type {
  CapabilitySnapshot,
  PlatformAdapter,
  PlatformEvent,
  ShellViewModel,
} from "../../../src/production/contracts.ts";
import { createProductionShell } from "../../../src/production/shell.ts";

function readyCapabilities(): CapabilitySnapshot {
  return {
    platform: "browser",
    lifecycle: "foreground",
    viewport: { width: 240, height: 282, orientation: "portrait" },
    firmware: { id: "fixture", status: "tested" },
    features: {
      semanticInput: "available",
      voice: "available",
      secureStorage: "available",
      deviceLock: "available",
      https: "available",
      wss: "available",
      crypto: "available",
      identity: "available",
      dataIntegrity: "available",
    },
  };
}

function createAdapter() {
  const listeners = new Set<(event: PlatformEvent) => void>();
  const adapter: PlatformAdapter = {
    kind: "browser",
    inspectCapabilities: async () => readyCapabilities(),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    startVoice: async (requestId) => ({ ok: true, requestId }),
    stopVoice: async (requestId) => ({ ok: true, requestId }),
    cancelVoice: async () => {},
    dispose() {
      listeners.clear();
    },
  };
  return {
    adapter,
    emit: (event: PlatformEvent) => {
      for (const listener of listeners) listener(event);
    },
  };
}

test("rejects touch and adapter commands in background without replaying them", async () => {
  const platform = createAdapter();
  const rendered: ShellViewModel[] = [];
  const shell = createProductionShell({
    adapter: platform.adapter,
    render: (viewModel) => rendered.push(viewModel),
  });
  await shell.start();

  assert.equal(shell.dispatch({ type: "next" }), "accepted");
  assert.equal(shell.state().focus, 1);

  platform.emit({
    type: "lifecycle",
    state: "background",
    cause: "pagehide",
    sequence: 1,
  });
  assert.equal(shell.dispatch({ type: "previous" }), "background");
  platform.emit({
    type: "command",
    command: { type: "previous" },
    source: "rabbit",
    sequence: 2,
  });
  assert.equal(shell.state().focus, 1);

  platform.emit({
    type: "lifecycle",
    state: "foreground",
    cause: "pageshow",
    sequence: 3,
  });
  assert.equal(shell.state().focus, 1);
  assert.equal(shell.dispatch({ type: "previous" }), "accepted");
  assert.equal(shell.state().focus, 0);
  assert.equal(rendered.at(-1)?.screen, "ready");
  shell.dispose();
});
