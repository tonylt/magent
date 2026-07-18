import test from "node:test";
import assert from "node:assert/strict";

import { createRabbitBridgeAdapter } from "../../demo/lib/rabbit-bridge-adapter.js";

function keyEvent(type, key, repeat = false) {
  const event = new Event(type);
  Object.defineProperties(event, {
    key: { value: key },
    repeat: { value: repeat },
  });
  return event;
}

function setup({ voice = true } = {}) {
  const host = new EventTarget();
  const document = new EventTarget();
  document.visibilityState = "visible";
  host.document = document;
  host.innerWidth = 240;
  host.innerHeight = 282;
  host.location = { protocol: "https:" };
  host.creationStorage = { secure: {} };
  const voiceMessages = [];
  if (voice) {
    host.CreationVoiceHandler = {
      postMessage: (message) => voiceMessages.push(message),
    };
  }
  return { host, document, voiceMessages };
}

test("normalizes RabbitOS and keyboard input and removes listeners on dispose", () => {
  const { host, document } = setup();
  const inputs = [];
  const adapter = createRabbitBridgeAdapter({
    host,
    document,
    onInput: (type, source) => inputs.push({ type, source }),
  });

  host.dispatchEvent(new Event("scrollUp"));
  host.dispatchEvent(new Event("scrollDown"));
  host.dispatchEvent(new Event("sideClick"));
  document.dispatchEvent(keyEvent("keydown", "ArrowDown"));
  document.dispatchEvent(keyEvent("keydown", "ArrowDown", true));
  document.dispatchEvent(keyEvent("keydown", " "));
  document.dispatchEvent(keyEvent("keyup", " "));

  assert.deepEqual(inputs, [
    { type: "previous", source: "rabbit" },
    { type: "next", source: "rabbit" },
    { type: "select", source: "rabbit" },
    { type: "next", source: "keyboard" },
    { type: "hold-start", source: "keyboard" },
    { type: "hold-end", source: "keyboard" },
  ]);

  adapter.dispose();
  host.dispatchEvent(new Event("scrollDown"));
  assert.equal(inputs.length, 6);
});

test("keeps speech single-flight, delivers one transcript, and restores prior plugin handler", () => {
  const { host, document, voiceMessages } = setup();
  const priorMessages = [];
  const transcripts = [];
  host.onPluginMessage = (message) => priorMessages.push(message.type);

  const adapter = createRabbitBridgeAdapter({
    host,
    document,
    onInput: () => {},
    onTranscript: (result) => transcripts.push(result),
  });
  const installedHandler = host.onPluginMessage;

  assert.deepEqual(adapter.startSpeech("request-1"), { ok: true, requestId: "request-1" });
  assert.deepEqual(adapter.startSpeech("request-2"), { ok: false, error: "busy" });
  assert.deepEqual(adapter.stopSpeech("request-1"), { ok: true, requestId: "request-1" });
  installedHandler({ type: "sttEnded", transcript: "  review me  " });
  installedHandler({ type: "sttEnded", transcript: "late duplicate" });

  assert.deepEqual(voiceMessages, ["start", "stop"]);
  assert.deepEqual(transcripts, [{ requestId: "request-1", transcript: "review me" }]);
  assert.deepEqual(priorMessages, ["sttEnded", "sttEnded"]);

  adapter.dispose();
  assert.notEqual(host.onPluginMessage, installedHandler);
  host.onPluginMessage({ type: "prior" });
  assert.equal(priorMessages.at(-1), "prior");
});

test("background lifecycle interrupts the controller and active speech exactly once", () => {
  const { host, document, voiceMessages } = setup();
  const interruptions = [];
  const voiceErrors = [];
  const lifecycle = [];
  const adapter = createRabbitBridgeAdapter({
    host,
    document,
    controller: {
      handle: () => {},
      interrupt: (reason) => interruptions.push(reason),
    },
    onVoiceError: (error) => voiceErrors.push(error),
    onLifecycle: (event) => lifecycle.push(event),
  });

  adapter.startSpeech("request-1");
  host.dispatchEvent(new Event("pagehide"));
  host.dispatchEvent(new Event("pagehide"));

  assert.deepEqual(interruptions, ["pagehide"]);
  assert.deepEqual(voiceMessages, ["start", "stop"]);
  assert.deepEqual(voiceErrors, [{ requestId: "request-1", code: "pagehide" }]);
  assert.deepEqual(lifecycle, [{ type: "lifecycle", state: "background", cause: "pagehide" }]);
  adapter.dispose();
});

test("rejects new input while backgrounded and resumes only after foreground", () => {
  const { host, document } = setup();
  const inputs = [];
  const adapter = createRabbitBridgeAdapter({
    host,
    document,
    onInput: (type) => inputs.push(type),
  });

  host.dispatchEvent(new Event("pagehide"));
  assert.equal(adapter.sendInput("focus-at", "touch", { focus: 2 }), false);
  host.dispatchEvent(new Event("longPressStart"));
  host.dispatchEvent(new Event("scrollDown"));
  host.dispatchEvent(new Event("pagehide"));
  assert.deepEqual(inputs, []);

  host.dispatchEvent(new Event("pageshow"));
  assert.equal(adapter.sendInput("focus-at", "touch", { focus: 2 }), true);
  host.dispatchEvent(new Event("scrollDown"));
  assert.deepEqual(inputs, ["focus-at", "next"]);
  adapter.dispose();
});

test("reports unsupported voice without throwing", () => {
  const { host, document } = setup({ voice: false });
  const adapter = createRabbitBridgeAdapter({ host, document, onInput: () => {} });
  assert.equal(adapter.capabilities().voice, false);
  assert.deepEqual(adapter.startSpeech("request-1"), { ok: false, error: "unsupported" });
  adapter.dispose();
});
