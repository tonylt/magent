// Pinned Relay fixtures: valid messages plus deliberate drift for each stage, and
// scripted endpoints replayed by the deterministic transport. Shared by unit tests
// now and reused by S05 real-R1 wiring later. Frame fields use recognizable
// sentinels so tests can prove the compatibility report never leaks payload.

import type { ScriptedTransportScript } from "./transport.ts";

export const SENSITIVE_SENTINELS = [
  "PUBLICKEY-DO-NOT-LOG",
  "NONCE-DO-NOT-LOG",
  "CIPHERTEXT-DO-NOT-LOG",
  "TAG-DO-NOT-LOG",
] as const;

export function helloAck(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { t: "hello-ack", protocol: 3, minClient: 3, relay: { id: "relay-fixture" }, ...overrides };
}

export function subscribeAck(topics: readonly string[] = ["directory", "attention"]): Record<string, unknown> {
  return { t: "subscribe-ack", topics: [...topics] };
}

export function frameSeq(seq: number): Record<string, unknown> {
  return { t: "frame", seq, nonce: "NONCE-DO-NOT-LOG", ciphertext: "CIPHERTEXT-DO-NOT-LOG", tag: "TAG-DO-NOT-LOG" };
}

export function validOffer(): Record<string, unknown> {
  return {
    v: 1,
    host: { id: "host-fixture" },
    relay: { endpoint: "wss://relay.fixture.invalid/host-fixture" },
    publicKey: "PUBLICKEY-DO-NOT-LOG",
  };
}

export function malformedOffer(): Record<string, unknown> {
  return { v: 1, relay: { endpoint: "wss://relay.fixture.invalid/host-fixture" }, publicKey: "PUBLICKEY-DO-NOT-LOG" };
}

export function insecureOffer(): Record<string, unknown> {
  return { ...validOffer(), relay: { endpoint: "ws://relay.fixture.invalid/host-fixture" } };
}

export function keylessOffer(): Record<string, unknown> {
  return { ...validOffer(), publicKey: "" };
}

export const endpointScripts = {
  wellBehaved: { inbound: [helloAck(), subscribeAck(), frameSeq(1), frameSeq(2)] },
  protocolTooOld: { inbound: [helloAck({ protocol: 2 })] },
  minClientNotMet: { inbound: [helloAck({ minClient: 4 })] },
  malformedHelloAck: { inbound: [{ t: "hello-ack" }] },
  subscriptionRejected: { inbound: [helloAck(), subscribeAck(["directory"])] },
  malformedFrame: { inbound: [helloAck(), subscribeAck(), { t: "frame", seq: 1, nonce: "n", ciphertext: "c" }] },
  frameSequenceGap: { inbound: [helloAck(), subscribeAck(), frameSeq(1), frameSeq(3)] },
  closeMidHandshake: { inbound: [helloAck()], closeAfterInbound: true },
} satisfies Record<string, ScriptedTransportScript>;
