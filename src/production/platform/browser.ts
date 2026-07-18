import type {
  CapabilitySnapshot,
  SemanticCommand,
  VoiceActionResult,
  VoiceResult,
} from "../contracts.ts";
import {
  createPlatformRuntime,
  type DocumentSurface,
  type HostSurface,
  type VoiceBoundary,
} from "./runtime.ts";

export interface BrowserVoiceFixture extends VoiceBoundary {
  subscribe(listener: (requestId: string, result: VoiceResult) => void): () => void;
  complete(requestId: string, result: VoiceResult): void;
}

export function createBrowserVoiceFixture(): BrowserVoiceFixture {
  const listeners = new Set<(requestId: string, result: VoiceResult) => void>();
  let activeRequest: string | null = null;
  let disposed = false;

  return {
    async start(requestId): Promise<VoiceActionResult> {
      if (disposed) return { ok: false, error: "disposed" };
      if (activeRequest) return { ok: false, error: "busy" };
      activeRequest = requestId;
      return { ok: true, requestId };
    },
    async stop(requestId): Promise<VoiceActionResult> {
      if (disposed) return { ok: false, error: "disposed" };
      return activeRequest === requestId
        ? { ok: true, requestId }
        : { ok: false, error: "not-active" };
    },
    async cancel(requestId): Promise<void> {
      if (activeRequest !== requestId) return;
      activeRequest = null;
      for (const listener of listeners) listener(requestId, { type: "error", code: "interrupted" });
    },
    subscribe(listener) {
      if (disposed) return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    complete(requestId, result) {
      if (disposed || activeRequest !== requestId) return;
      activeRequest = null;
      for (const listener of listeners) listener(requestId, result);
    },
    dispose() {
      disposed = true;
      activeRequest = null;
      listeners.clear();
    },
  };
}

function orientation(width: number, height: number): "portrait" | "landscape" | "unknown" {
  if (width === height) return "unknown";
  return width < height ? "portrait" : "landscape";
}

export function createBrowserPlatformAdapter({
  host,
  document,
  capabilities,
  voice,
}: {
  host: HostSurface;
  document: DocumentSurface;
  capabilities?: CapabilitySnapshot;
  voice?: BrowserVoiceFixture;
}) {
  return createPlatformRuntime({
    kind: "browser",
    host,
    document,
    ...(voice ? { voice } : {}),
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
    attach({ listen, dispatch, emitVoiceResult }) {
      const unsubscribeVoice = voice?.subscribe(emitVoiceResult);
      function keyCommand(event: Event): SemanticCommand | null {
        const keyboard = event as KeyboardEvent;
        if (keyboard.repeat) return null;
        if (event.type === "keyup" && keyboard.key !== " ") return null;
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
      return unsubscribeVoice;
    },
  });
}
