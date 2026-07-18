import test from "node:test";
import assert from "node:assert/strict";

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
