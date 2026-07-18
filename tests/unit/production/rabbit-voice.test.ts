import test from "node:test";
import assert from "node:assert/strict";

import type { PlatformEvent } from "../../../src/production/contracts.ts";
import { createRabbitPlatformAdapter } from "../../../src/production/platform/rabbit.ts";

interface RabbitTestHost extends EventTarget {
  innerWidth: number;
  innerHeight: number;
  location: { protocol: string };
  CreationVoiceHandler: { postMessage(message: "start" | "stop"): void };
  onPluginMessage?: (message: unknown) => void;
}

function createRabbitDom() {
  const messages: string[] = [];
  const host = new EventTarget() as RabbitTestHost;
  host.innerWidth = 240;
  host.innerHeight = 282;
  host.location = { protocol: "https:" };
  host.CreationVoiceHandler = { postMessage: (message) => messages.push(message) };
  const document = new EventTarget() as EventTarget & { visibilityState: string };
  document.visibilityState = "visible";
  return { host, document, messages };
}

test("rejects an empty voice request identity before touching the native bridge", async () => {
  const dom = createRabbitDom();
  const adapter = createRabbitPlatformAdapter(dom);
  assert.deepEqual(await adapter.startVoice(""), { ok: false, error: "invalid-request" });
  assert.deepEqual(dom.messages, []);
  adapter.dispose();
});

test("cancels on background and drains the old terminal before a new request", async () => {
  const dom = createRabbitDom();
  const adapter = createRabbitPlatformAdapter(dom);
  const events: PlatformEvent[] = [];
  adapter.subscribe((event) => events.push(event));

  assert.deepEqual(await adapter.startVoice("voice-1"), { ok: true, requestId: "voice-1" });
  dom.host.dispatchEvent(new Event("pagehide"));
  await Promise.resolve();
  assert.deepEqual(dom.messages, ["start", "stop"]);
  assert.deepEqual(await adapter.startVoice("voice-2"), { ok: false, error: "background" });

  dom.host.onPluginMessage?.({ type: "sttEnded", transcript: "old transcript" });
  assert.equal(events.filter((event) => event.type === "voice-result").length, 1);

  dom.host.dispatchEvent(new Event("pageshow"));
  assert.deepEqual(await adapter.startVoice("voice-2"), { ok: true, requestId: "voice-2" });
  assert.deepEqual(await adapter.stopVoice("voice-2"), { ok: true, requestId: "voice-2" });
  dom.host.onPluginMessage?.({ type: "sttEnded", transcript: "new transcript" });
  dom.host.onPluginMessage?.({ type: "sttEnded", transcript: "late duplicate" });

  const voiceResults = events.filter((event) => event.type === "voice-result");
  assert.deepEqual(voiceResults.map(({ requestId, result }) => ({ requestId, result })), [
    { requestId: "voice-1", result: { type: "error", code: "interrupted" } },
    { requestId: "voice-2", result: { type: "transcript", text: "new transcript" } },
  ]);
  adapter.dispose();
});

test("quarantines a normal terminal before binding another request", async () => {
  const dom = createRabbitDom();
  const adapter = createRabbitPlatformAdapter({ ...dom, terminalQuarantineMs: 1_000 });

  assert.deepEqual(await adapter.startVoice("voice-1"), { ok: true, requestId: "voice-1" });
  dom.host.onPluginMessage?.({ type: "sttEnded", transcript: "first" });
  assert.deepEqual(await adapter.startVoice("voice-2"), { ok: false, error: "busy" });

  dom.host.onPluginMessage?.({ type: "sttEnded", transcript: "late duplicate" });
  assert.deepEqual(await adapter.startVoice("voice-2"), { ok: true, requestId: "voice-2" });
  adapter.dispose();
});

test("dispose stops active native voice and makes voice APIs terminal", async () => {
  const dom = createRabbitDom();
  const adapter = createRabbitPlatformAdapter(dom);
  await adapter.startVoice("voice-1");
  adapter.dispose();

  assert.deepEqual(dom.messages, ["start", "stop"]);
  assert.deepEqual(await adapter.startVoice("voice-2"), { ok: false, error: "disposed" });
  assert.deepEqual(await adapter.stopVoice("voice-1"), { ok: false, error: "disposed" });
});
