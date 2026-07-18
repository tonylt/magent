import type { CapabilitySnapshot, VoiceActionResult, VoiceResult } from "../contracts.ts";
import {
  createPlatformRuntime,
  type DocumentSurface,
  type HostSurface,
  voiceFailure,
} from "./runtime.ts";

interface RabbitHost extends HostSurface {
  CreationVoiceHandler?: { postMessage(message: "start" | "stop"): void };
  creationStorage?: { secure?: unknown };
  creationSensors?: unknown;
  onPluginMessage?: (message: unknown) => void;
}

function orientation(width: number, height: number): "portrait" | "landscape" | "unknown" {
  if (width === height) return "unknown";
  return width < height ? "portrait" : "landscape";
}

export function createRabbitPlatformAdapter({
  host,
  document,
  capabilities,
}: {
  host: RabbitHost;
  document: DocumentSurface;
  capabilities?: CapabilitySnapshot;
}) {
  let activeRequest: string | null = null;
  let drainingRequest: string | null = null;
  let emitVoiceResult: ((requestId: string, result: VoiceResult) => void) | null = null;
  const previousPluginMessage = host.onPluginMessage;

  const voice = {
    async start(requestId: string): Promise<VoiceActionResult> {
      if (!host.CreationVoiceHandler) return voiceFailure("unsupported");
      if (activeRequest || drainingRequest) return voiceFailure("busy");
      activeRequest = requestId;
      try {
        host.CreationVoiceHandler.postMessage("start");
        return { ok: true, requestId };
      } catch {
        activeRequest = null;
        return voiceFailure("bridge-error");
      }
    },
    async stop(requestId: string): Promise<VoiceActionResult> {
      if (!activeRequest || activeRequest !== requestId) return voiceFailure("not-active");
      try {
        host.CreationVoiceHandler?.postMessage("stop");
        return { ok: true, requestId };
      } catch {
        activeRequest = null;
        return voiceFailure("bridge-error");
      }
    },
    async cancel(requestId: string): Promise<void> {
      if (!activeRequest || activeRequest !== requestId) return;
      try {
        host.CreationVoiceHandler?.postMessage("stop");
      } catch {
        // The request remains terminal locally even if native cleanup fails.
      }
      activeRequest = null;
      drainingRequest = requestId;
      emitVoiceResult?.(requestId, { type: "error", code: "interrupted" });
    },
    dispose(): void {
      activeRequest = null;
      drainingRequest = null;
      emitVoiceResult = null;
    },
  };

  return createPlatformRuntime({
    kind: "rabbit",
    host,
    document,
    voice,
    inspectCapabilities: async () => capabilities ?? ({
      platform: "rabbit",
      lifecycle: document.visibilityState === "hidden" ? "background" : "foreground",
      viewport: {
        width: host.innerWidth,
        height: host.innerHeight,
        orientation: orientation(host.innerWidth, host.innerHeight),
      },
      firmware: { status: "unknown" },
      features: {
        semanticInput: "available",
        voice: host.CreationVoiceHandler ? "available" : "missing",
        secureStorage: host.creationStorage?.secure ? "available" : "missing",
        deviceLock: "unknown",
        https: host.location.protocol === "https:" ? "available" : "missing",
        wss: "unknown",
        crypto: "unknown",
        identity: "unknown",
        dataIntegrity: "unknown",
      },
    }),
    attach(hooks) {
      emitVoiceResult = hooks.emitVoiceResult;
      hooks.listen(host, "scrollUp", () => hooks.dispatch({ type: "previous" }, "rabbit"));
      hooks.listen(host, "scrollDown", () => hooks.dispatch({ type: "next" }, "rabbit"));
      hooks.listen(host, "sideClick", () => hooks.dispatch({ type: "activate" }, "rabbit"));
      hooks.listen(host, "longPressStart", () => hooks.dispatch({ type: "hold-start" }, "rabbit"));
      hooks.listen(host, "longPressEnd", () => hooks.dispatch({ type: "hold-end" }, "rabbit"));

      const pluginMessage = (message: unknown) => {
        previousPluginMessage?.(message);
        if (!message || typeof message !== "object" || !("type" in message)) return;
        const plugin = message as { type: unknown; transcript?: unknown };
        if (plugin.type !== "sttEnded") return;
        if (drainingRequest) {
          drainingRequest = null;
          return;
        }
        if (!activeRequest) return;
        const requestId = activeRequest;
        activeRequest = null;
        const transcript = typeof plugin.transcript === "string" ? plugin.transcript.trim() : "";
        hooks.emitVoiceResult(
          requestId,
          transcript
            ? { type: "transcript", text: transcript }
            : { type: "error", code: "empty-transcript" },
        );
      };
      host.onPluginMessage = pluginMessage;
      return () => {
        if (host.onPluginMessage !== pluginMessage) return;
        if (previousPluginMessage === undefined) delete host.onPluginMessage;
        else host.onPluginMessage = previousPluginMessage;
      };
    },
  });
}
