import type { CapabilitySnapshot, PlatformKind, ProductionShell } from "./contracts.ts";
import { createProductionShell } from "./shell.ts";
import { createBrowserPlatformAdapter } from "./platform/browser.ts";
import { createRabbitPlatformAdapter, isRabbitHost } from "./platform/rabbit.ts";
import { createProductionView } from "./view.ts";

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
const capabilities = new URLSearchParams(location.search).get("fixture") === "supported"
  ? supportedCapabilities(platform)
  : undefined;
const fixture = capabilities ? { capabilities } : {};
const adapter = rabbit
  ? createRabbitPlatformAdapter({ host: window, document, ...fixture })
  : createBrowserPlatformAdapter({ host: window, document, ...fixture });

let shell: ProductionShell;
const render = createProductionView({
  root,
  platform,
  dispatch: (command) => { shell.dispatch(command); },
});
shell = createProductionShell({ adapter, render });
void shell.start();
