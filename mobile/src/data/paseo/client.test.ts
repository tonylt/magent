import test from "node:test";
import assert from "node:assert/strict";

import { createDaemonRepository, type PaseoEvent, type PaseoProtocol } from "./client.ts";
import type { RelayTransport, TransportStatus } from "./transport.ts";
import type { Attention } from "../../domain/types.ts";

function fakeTransport() {
  let messageCb: ((m: unknown) => void) | null = null;
  let statusCb: ((s: TransportStatus) => void) | null = null;
  const sent: unknown[] = [];
  const transport: RelayTransport = {
    status: "connecting",
    send: (m) => sent.push(m),
    onMessage: (cb) => { messageCb = cb; return () => { messageCb = null; }; },
    onStatus: (cb) => { statusCb = cb; return () => { statusCb = null; }; },
    close: () => {},
  };
  return {
    transport,
    sent,
    emit: (m: unknown) => messageCb?.(m),
    setStatus: (s: TransportStatus) => statusCb?.(s),
  };
}

const attn: Attention = {
  id: "at1", agentId: "a1", workspaceId: "w1", reason: "permission",
  summary: "Allow write", createdAt: 1000, freshness: "live",
};

const protocol: PaseoProtocol = {
  handshake: (pair) => [{ t: "hello", host: pair.hostId }, { t: "subscribe" }],
  decode: (frame) => {
    const f = frame as { t?: string; items?: Attention[] };
    if (f.t === "attention") return { type: "attention", attention: f.items ?? [] } as PaseoEvent;
    return null;
  },
};

test("sends the handshake on open and projects decoded frames", async () => {
  const fake = fakeTransport();
  const repo = createDaemonRepository({ transport: fake.transport, pair: { raw: "x", hostId: "h1" }, protocol });

  fake.setStatus("open");
  assert.deepEqual(fake.sent, [{ t: "hello", host: "h1" }, { t: "subscribe" }]);

  fake.emit({ t: "attention", items: [attn] });
  await repo.ready();
  assert.deepEqual(await repo.listAttention(), [attn]);
  repo.close();
});

test("ready rejects if the relay closes before initial sync", async () => {
  const fake = fakeTransport();
  const repo = createDaemonRepository({ transport: fake.transport, pair: { raw: "x" }, protocol });
  fake.setStatus("closed");
  await assert.rejects(repo.ready(), /before initial sync/);
  repo.close();
});

test("host snapshot falls back to syncing before the daemon sends one", async () => {
  const fake = fakeTransport();
  const repo = createDaemonRepository({ transport: fake.transport, pair: { raw: "x", hostId: "h9" }, protocol });
  const snapshot = await repo.getHostSnapshot();
  assert.equal(snapshot.freshness, "syncing");
  assert.equal(snapshot.hostName, "h9");
  repo.close();
});
