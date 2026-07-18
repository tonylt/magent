import type { CapabilitySnapshot, PlatformKind, ProductionShell, RelayCompatibilitySource } from "./contracts.ts";
import { createProductionShell } from "./shell.ts";
import { createBrowserPlatformAdapter, createBrowserVoiceFixture } from "./platform/browser.ts";
import { createRabbitPlatformAdapter, isRabbitHost } from "./platform/rabbit.ts";
import { createProductionView } from "./view.ts";
import { allowsLocalFixtures } from "./fixture.ts";
import { traceRelayCompatibility } from "./relay/relay-client.ts";
import { createScriptedTransport } from "./relay/transport.ts";
import { endpointScripts, validOffer } from "./relay/fixtures.ts";

function supportedCapabilities(platform: PlatformKind): CapabilitySnapshot {
  return {
    platform,
    lifecycle: document.visibilityState === "hidden" ? "background" : "foreground",
    viewport: { width: innerWidth, height: innerHeight, orientation: "portrait" },
    firmware: { id: "deterministic-browser-fixture", status: "tested" },
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

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing #app root");

const rabbit = isRabbitHost(window);
const platform: PlatformKind = rabbit ? "rabbit" : "browser";
const useFixture = allowsLocalFixtures(location)
  && new URLSearchParams(location.search).get("fixture") === "supported";
const capabilities = useFixture
  ? supportedCapabilities(platform)
  : undefined;
const fixture = capabilities ? { capabilities } : {};
const adapter = rabbit
  ? createRabbitPlatformAdapter({ host: window, document, ...fixture })
  : createBrowserPlatformAdapter({
      host: window,
      document,
      ...fixture,
      ...(useFixture ? { voice: createBrowserVoiceFixture() } : {}),
    });

let shell: ProductionShell;
const render = createProductionView({
  root,
  platform,
  dispatch: (command) => { adapter.sendCommand(command, "touch"); },
});

// Fixture-driven Relay negotiation (loopback only): ?relay=<script> replays an S04
// pinned endpoint through the scripted transport. Production S05 supplies a real
// WSS/E2EE source instead. Without the flag the shell stays in device-only mode.
const relayParam = useFixture ? new URLSearchParams(location.search).get("relay") : null;
const relaySource: RelayCompatibilitySource | undefined =
  relayParam && Object.prototype.hasOwnProperty.call(endpointScripts, relayParam)
    ? () => traceRelayCompatibility({
        transport: createScriptedTransport(endpointScripts[relayParam as keyof typeof endpointScripts]),
        offer: validOffer(),
      })
    : undefined;

shell = createProductionShell({ adapter, render, ...(relaySource ? { relaySource } : {}) });
void shell.start();
