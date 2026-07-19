import test from "node:test";
import assert from "node:assert/strict";

import type {
  CapabilitySnapshot,
  PlatformAdapter,
  PlatformEvent,
  RelayCompatibilitySource,
  ShellViewModel,
} from "../../../src/production/contracts.ts";
import { createProductionShell } from "../../../src/production/shell.ts";
import { traceRelayCompatibility } from "../../../src/production/relay/relay-client.ts";
import { createScriptedTransport } from "../../../src/production/relay/transport.ts";
import { SENSITIVE_SENTINELS, endpointScripts, validOffer } from "../../../src/production/relay/fixtures.ts";

function supportedSnapshot(): CapabilitySnapshot {
  return {
    platform: "browser",
    lifecycle: "foreground",
    viewport: { width: 240, height: 292, orientation: "portrait" },
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

function createAdapter(snapshot: CapabilitySnapshot): PlatformAdapter {
  const listeners = new Set<(event: PlatformEvent) => void>();
  return {
    kind: snapshot.platform,
    inspectCapabilities: async () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    sendCommand: () => false,
    startVoice: async () => ({ ok: false, error: "unsupported" }),
    stopVoice: async () => ({ ok: false, error: "not-active" }),
    cancelVoice: async () => {},
    dispose() {
      listeners.clear();
    },
  };
}

function scriptedSource(name: keyof typeof endpointScripts): RelayCompatibilitySource {
  return () => traceRelayCompatibility({ transport: createScriptedTransport(endpointScripts[name]), offer: validOffer() });
}

async function settle(): Promise<void> {
  for (let i = 0; i < 8; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

test("a well-behaved relay negotiates the shell to relay-compatible ready", async () => {
  const rendered: ShellViewModel[] = [];
  const shell = createProductionShell({
    adapter: createAdapter(supportedSnapshot()),
    render: (view) => rendered.push(view),
    relaySource: scriptedSource("wellBehaved"),
  });
  await shell.start();
  await settle();

  assert.equal(rendered[0]?.screen, "checking");
  assert.ok(rendered.some((view) => view.screen === "checking-relay"));
  const last = rendered.at(-1);
  assert.equal(last?.screen, "ready");
  if (last?.screen === "ready") {
    assert.equal(last.status, "RELAY COMPATIBLE");
    assert.equal(last.items.at(-1)?.title, "RELAY COMPATIBLE");
  }
  shell.dispose();
});

test("an old relay protocol shows a recoverable upgrade-required screen", async () => {
  const rendered: ShellViewModel[] = [];
  const shell = createProductionShell({
    adapter: createAdapter(supportedSnapshot()),
    render: (view) => rendered.push(view),
    relaySource: scriptedSource("protocolTooOld"),
  });
  await shell.start();
  await settle();

  const last = rendered.at(-1);
  assert.equal(last?.screen, "recover");
  if (last?.screen === "recover") {
    assert.equal(last.title, "UPGRADE REQUIRED");
    assert.equal(last.recoverable, true);
    assert.deepEqual(last.reasons, ["RELAY PROTOCOL TOO OLD"]);
  }
  assert.equal(shell.state().status, "upgrade-required");
  shell.dispose();
});

test("a malformed frame shows a recoverable unsupported screen", async () => {
  const rendered: ShellViewModel[] = [];
  const shell = createProductionShell({
    adapter: createAdapter(supportedSnapshot()),
    render: (view) => rendered.push(view),
    relaySource: scriptedSource("malformedFrame"),
  });
  await shell.start();
  await settle();

  const last = rendered.at(-1);
  assert.equal(last?.screen, "recover");
  if (last?.screen === "recover") {
    assert.equal(last.title, "UNSUPPORTED");
    assert.equal(last.recoverable, true);
    assert.deepEqual(last.reasons, ["MALFORMED FRAME"]);
  }
  shell.dispose();
});

test("retry from a recoverable screen re-runs negotiation and can recover", async () => {
  const rendered: ShellViewModel[] = [];
  const scripts: (keyof typeof endpointScripts)[] = ["protocolTooOld", "wellBehaved"];
  let call = 0;
  const relaySource: RelayCompatibilitySource = () => {
    const name = scripts[Math.min(call, scripts.length - 1)];
    call += 1;
    return traceRelayCompatibility({ transport: createScriptedTransport(endpointScripts[name]), offer: validOffer() });
  };
  const shell = createProductionShell({
    adapter: createAdapter(supportedSnapshot()),
    render: (view) => rendered.push(view),
    relaySource,
  });
  await shell.start();
  await settle();
  assert.equal(rendered.at(-1)?.screen, "recover");

  const outcome = shell.dispatch({ type: "activate" });
  assert.equal(outcome, "accepted");
  await settle();

  assert.equal(call, 2, "retry must re-invoke the relay source");
  assert.equal(rendered.at(-1)?.screen, "ready");
  shell.dispose();
});

test("device-hardware unsupported never contacts the relay", async () => {
  const rendered: ShellViewModel[] = [];
  let relayCalls = 0;
  const relaySource: RelayCompatibilitySource = () => {
    relayCalls += 1;
    return traceRelayCompatibility({ transport: createScriptedTransport(endpointScripts.wellBehaved), offer: validOffer() });
  };
  const snapshot = supportedSnapshot();
  const shell = createProductionShell({
    adapter: createAdapter({ ...snapshot, features: { ...snapshot.features, crypto: "missing" } }),
    render: (view) => rendered.push(view),
    relaySource,
  });
  await shell.start();
  await settle();

  assert.equal(relayCalls, 0);
  assert.equal(rendered.some((view) => view.screen === "checking-relay"), false);
  const last = rendered.at(-1);
  assert.equal(last?.screen, "unsupported");
  if (last?.screen === "recover") assert.fail("device failure must not be recoverable");
  shell.dispose();
});

test("negotiation diagnostics stay payload-free", async () => {
  const shell = createProductionShell({
    adapter: createAdapter(supportedSnapshot()),
    render: () => {},
    relaySource: scriptedSource("wellBehaved"),
  });
  await shell.start();
  await settle();
  const serialized = JSON.stringify(shell.diagnostics());
  for (const sentinel of SENSITIVE_SENTINELS) assert.equal(serialized.includes(sentinel), false);
  shell.dispose();
});
