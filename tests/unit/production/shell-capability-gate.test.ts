import test from "node:test";
import assert from "node:assert/strict";

import type {
  CapabilitySnapshot,
  PlatformAdapter,
  PlatformEvent,
  ShellViewModel,
} from "../../../src/production/contracts.ts";
import { createProductionShell } from "../../../src/production/shell.ts";

function createAdapter(capabilities: CapabilitySnapshot): PlatformAdapter {
  const listeners = new Set<(event: PlatformEvent) => void>();
  return {
    kind: capabilities.platform,
    inspectCapabilities: async () => capabilities,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    startVoice: async () => ({ ok: false, error: "unsupported" }),
    stopVoice: async () => ({ ok: false, error: "not-active" }),
    cancelVoice: async () => {},
    dispose() {
      listeners.clear();
    },
  };
}

test("checks device capabilities before rendering a Rabbit shell as limited", async () => {
  const rendered: ShellViewModel[] = [];
  const adapter = createAdapter({
    platform: "rabbit",
    lifecycle: "foreground",
    viewport: { width: 240, height: 282, orientation: "portrait" },
    firmware: { status: "unknown" },
    features: {
      semanticInput: "available",
      voice: "available",
      secureStorage: "missing",
      deviceLock: "available",
      https: "available",
      wss: "available",
      crypto: "available",
      identity: "available",
      dataIntegrity: "available",
    },
  });

  const shell = createProductionShell({
    adapter,
    render: (viewModel) => rendered.push(viewModel),
  });
  await shell.start();

  assert.equal(rendered[0]?.screen, "checking");
  assert.deepEqual(rendered.at(-1), {
    screen: "limited",
    title: "LIMITED",
    status: "READ ONLY",
    reasons: ["UNKNOWN FIRMWARE", "NO SECURE STORAGE"],
    focus: 0,
  });
  assert.equal(shell.state().capabilitiesChecked, true);
  assert.equal(shell.state().productDataEnabled, false);
  shell.dispose();
});

test("fails closed when capability inspection rejects", async () => {
  const rendered: ShellViewModel[] = [];
  const adapter = createAdapter({} as CapabilitySnapshot);
  adapter.inspectCapabilities = async () => { throw new Error("private bridge detail"); };
  const shell = createProductionShell({ adapter, render: (view) => rendered.push(view) });

  await shell.start();
  assert.equal(rendered.at(-1)?.screen, "unsupported");
  assert.equal(rendered.at(-1)?.status, "NO DATA");
  assert.equal(JSON.stringify(shell.diagnostics()).includes("private bridge detail"), false);
  shell.dispose();
});
