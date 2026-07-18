import test from "node:test";
import assert from "node:assert/strict";

import type { PlatformEvent } from "../../../src/production/contracts.ts";
import { createBrowserPlatformAdapter } from "../../../src/production/platform/browser.ts";
import { createRabbitPlatformAdapter } from "../../../src/production/platform/rabbit.ts";

interface TestHost extends EventTarget {
  innerWidth: number;
  innerHeight: number;
  location: { protocol: string };
}

interface TestDocument extends EventTarget {
  visibilityState: "visible" | "hidden";
}

function createDom() {
  const host = new EventTarget() as TestHost;
  host.innerWidth = 240;
  host.innerHeight = 282;
  host.location = { protocol: "https:" };
  const document = new EventTarget() as TestDocument;
  document.visibilityState = "visible";
  return { host, document };
}

function key(type: "keydown" | "keyup", value: string): Event {
  const event = new Event(type);
  Object.defineProperties(event, {
    key: { value },
    repeat: { value: false },
  });
  return event;
}

function commands(events: PlatformEvent[]) {
  return events
    .filter((event) => event.type === "command")
    .map((event) => event.command);
}

test("browser and Rabbit raw input produce the same foreground semantic commands", () => {
  const browserDom = createDom();
  const rabbitDom = createDom();
  const browser = createBrowserPlatformAdapter(browserDom);
  const rabbit = createRabbitPlatformAdapter(rabbitDom);
  const browserEvents: PlatformEvent[] = [];
  const rabbitEvents: PlatformEvent[] = [];
  browser.subscribe((event) => browserEvents.push(event));
  rabbit.subscribe((event) => rabbitEvents.push(event));

  browserDom.document.dispatchEvent(key("keydown", "ArrowDown"));
  browserDom.document.dispatchEvent(key("keydown", "Enter"));
  browserDom.document.dispatchEvent(key("keydown", " "));
  browserDom.document.dispatchEvent(key("keyup", " "));

  rabbitDom.host.dispatchEvent(new Event("scrollDown"));
  rabbitDom.host.dispatchEvent(new Event("sideClick"));
  rabbitDom.host.dispatchEvent(new Event("longPressStart"));
  rabbitDom.host.dispatchEvent(new Event("longPressEnd"));

  assert.deepEqual(commands(browserEvents), commands(rabbitEvents));
  assert.deepEqual(commands(browserEvents), [
    { type: "next" },
    { type: "activate" },
    { type: "hold-start" },
    { type: "hold-end" },
  ]);

  browserDom.host.dispatchEvent(new Event("pagehide"));
  rabbitDom.host.dispatchEvent(new Event("pagehide"));
  browserDom.document.dispatchEvent(key("keydown", "ArrowDown"));
  rabbitDom.host.dispatchEvent(new Event("scrollDown"));
  assert.equal(commands(browserEvents).length, 4);
  assert.equal(commands(rabbitEvents).length, 4);

  browserDom.host.dispatchEvent(new Event("pageshow"));
  rabbitDom.host.dispatchEvent(new Event("pageshow"));
  browserDom.document.dispatchEvent(key("keydown", "ArrowUp"));
  rabbitDom.host.dispatchEvent(new Event("scrollUp"));
  assert.deepEqual(commands(browserEvents).at(-1), { type: "previous" });
  assert.deepEqual(commands(rabbitEvents).at(-1), { type: "previous" });

  browser.dispose();
  rabbit.dispose();
});
