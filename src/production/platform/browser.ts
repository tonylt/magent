import type { CapabilitySnapshot, SemanticCommand } from "../contracts.ts";
import {
  createPlatformRuntime,
  type DocumentSurface,
  type HostSurface,
} from "./runtime.ts";

function orientation(width: number, height: number): "portrait" | "landscape" | "unknown" {
  if (width === height) return "unknown";
  return width < height ? "portrait" : "landscape";
}

export function createBrowserPlatformAdapter({
  host,
  document,
  capabilities,
}: {
  host: HostSurface;
  document: DocumentSurface;
  capabilities?: CapabilitySnapshot;
}) {
  return createPlatformRuntime({
    kind: "browser",
    host,
    document,
    inspectCapabilities: async () => capabilities ?? ({
      platform: "browser",
      lifecycle: document.visibilityState === "hidden" ? "background" : "foreground",
      viewport: {
        width: host.innerWidth,
        height: host.innerHeight,
        orientation: orientation(host.innerWidth, host.innerHeight),
      },
      firmware: { id: "browser-fixture", status: "tested" },
      features: {
        semanticInput: "available",
        voice: "missing",
        secureStorage: "missing",
        deviceLock: "missing",
        https: host.location.protocol === "https:" ? "available" : "unknown",
        wss: "unknown",
        crypto: "unknown",
        identity: "unknown",
        dataIntegrity: "unknown",
      },
    }),
    attach({ listen, dispatch }) {
      function keyCommand(event: Event): SemanticCommand | null {
        const keyboard = event as KeyboardEvent;
        if (keyboard.repeat) return null;
        if (keyboard.key === "ArrowUp") return { type: "previous" };
        if (keyboard.key === "ArrowDown") return { type: "next" };
        if (keyboard.key === "Enter") return { type: "activate" };
        if (keyboard.key === "Escape" || keyboard.key === "Backspace") return { type: "back" };
        if (keyboard.key === " ") return { type: event.type === "keydown" ? "hold-start" : "hold-end" };
        return null;
      }
      const onKey = (event: Event) => {
        const command = keyCommand(event);
        if (!command) return;
        event.preventDefault();
        dispatch(command, "keyboard");
      };
      listen(document, "keydown", onKey);
      listen(document, "keyup", onKey);
    },
  });
}
