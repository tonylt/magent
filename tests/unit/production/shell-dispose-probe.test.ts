import test from "node:test";
import assert from "node:assert/strict";

import type { CapabilitySnapshot, PlatformAdapter, ShellViewModel } from "../../../src/production/contracts.ts";
import { createProductionShell } from "../../../src/production/shell.ts";

test("disposing during a capability probe prevents a late ready render", async () => {
  let resolveProbe!: (snapshot: CapabilitySnapshot) => void;
  let adapterDisposed = false;
  const probe = new Promise<CapabilitySnapshot>((resolve) => { resolveProbe = resolve; });
  const adapter: PlatformAdapter = {
    kind: "browser",
    inspectCapabilities: () => probe,
    subscribe: () => () => {},
    sendCommand: () => false,
    startVoice: async () => ({ ok: false, error: "unsupported" }),
    stopVoice: async () => ({ ok: false, error: "not-active" }),
    cancelVoice: async () => {},
    dispose: () => { adapterDisposed = true; },
  };
  const rendered: ShellViewModel[] = [];
  const shell = createProductionShell({ adapter, render: (view) => rendered.push(view) });

  const start = shell.start();
  shell.dispose();
  resolveProbe({
    platform: "browser",
    lifecycle: "foreground",
    viewport: { width: 240, height: 292, orientation: "portrait" },
    firmware: { status: "tested" },
    features: {
      semanticInput: "available", voice: "available", secureStorage: "available",
      deviceLock: "available", https: "available", wss: "available", crypto: "available",
      identity: "available", dataIntegrity: "available",
    },
  });
  await start;

  assert.equal(adapterDisposed, true);
  assert.equal(shell.state().status, "disposed");
  assert.deepEqual(rendered.map((view) => view.screen), ["checking"]);
});
