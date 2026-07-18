import { createProductionInputController } from "../input-controller.ts";
import type {
  CapabilitySnapshot,
  InputSource,
  PlatformAdapter,
  PlatformEvent,
  PlatformKind,
  SemanticCommand,
  VoiceActionResult,
  VoiceError,
  VoiceResult,
} from "../contracts.ts";

type UnsequencedEvent = PlatformEvent extends infer EventType
  ? EventType extends { sequence: number }
    ? Omit<EventType, "sequence">
    : never
  : never;

export interface HostSurface extends EventTarget {
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly location: { readonly protocol: string };
}

export interface DocumentSurface extends EventTarget {
  readonly visibilityState: string;
}

type ListenerTarget = Pick<EventTarget, "addEventListener" | "removeEventListener">;

interface RuntimeHooks {
  listen(target: ListenerTarget, type: string, listener: EventListener): void;
  dispatch(command: SemanticCommand, source: InputSource): boolean;
  emitVoiceResult(requestId: string, result: VoiceResult): void;
}

interface VoiceBoundary {
  start(requestId: string): Promise<VoiceActionResult>;
  stop(requestId: string): Promise<VoiceActionResult>;
  cancel(requestId: string, reason: "background" | "user" | "timeout"): Promise<void>;
  dispose(): void;
}

const unsupportedVoice: VoiceBoundary = {
  start: async () => ({ ok: false, error: "unsupported" }),
  stop: async () => ({ ok: false, error: "not-active" }),
  cancel: async () => {},
  dispose: () => {},
};

export function createPlatformRuntime({
  kind,
  host,
  document,
  inspectCapabilities,
  attach,
  voice = unsupportedVoice,
}: {
  kind: PlatformKind;
  host: HostSurface;
  document: DocumentSurface;
  inspectCapabilities: () => Promise<CapabilitySnapshot>;
  attach: (hooks: RuntimeHooks) => (() => void) | void;
  voice?: VoiceBoundary;
}): PlatformAdapter {
  const subscribers = new Set<(event: PlatformEvent) => void>();
  const cleanups: Array<() => void> = [];
  let lifecycle: "foreground" | "background" = document.visibilityState === "hidden"
    ? "background"
    : "foreground";
  let sequence = 0;
  let disposed = false;
  let voiceRequest: string | null = null;

  function emit(event: UnsequencedEvent): void {
    if (disposed) return;
    const sequenced = { ...event, sequence: ++sequence } as PlatformEvent;
    for (const subscriber of subscribers) subscriber(sequenced);
  }

  const input = createProductionInputController({
    emit: (command, source) => emit({ type: "command", command, source }),
  });

  function listen(target: ListenerTarget, type: string, listener: EventListener): void {
    target.addEventListener(type, listener);
    cleanups.push(() => target.removeEventListener(type, listener));
  }

  function dispatch(command: SemanticCommand, source: InputSource): boolean {
    if (disposed || lifecycle === "background") return false;
    return input.handle(command, source);
  }

  function transitionLifecycle(
    state: "foreground" | "background",
    cause: "visibility" | "pagehide" | "pageshow",
  ): void {
    if (disposed || lifecycle === state) return;
    lifecycle = state;
    if (state === "background") {
      input.interrupt();
      const requestId = voiceRequest;
      voiceRequest = null;
      if (requestId) void voice.cancel(requestId, "background");
    }
    emit({ type: "lifecycle", state, cause });
  }

  listen(document, "visibilitychange", () => {
    transitionLifecycle(document.visibilityState === "hidden" ? "background" : "foreground", "visibility");
  });
  listen(host, "pagehide", () => transitionLifecycle("background", "pagehide"));
  listen(host, "pageshow", () => transitionLifecycle("foreground", "pageshow"));

  const detach = attach({
    listen,
    dispatch,
    emitVoiceResult: (requestId, result) => {
      if (voiceRequest === requestId) voiceRequest = null;
      emit({ type: "voice-result", requestId, result });
    },
  });
  if (detach) cleanups.push(detach);

  function validRequestId(requestId: string): boolean {
    return requestId.length > 0
      && requestId.length <= 128
      && /^[A-Za-z0-9._:-]+$/.test(requestId);
  }

  function isBackground(): boolean {
    return lifecycle === "background";
  }

  return {
    kind,
    async inspectCapabilities() {
      const snapshot = await inspectCapabilities();
      return { ...snapshot, lifecycle };
    },
    subscribe(listener) {
      if (disposed) return () => {};
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },
    async startVoice(requestId) {
      if (!validRequestId(requestId)) return Promise.resolve(voiceFailure("invalid-request"));
      if (isBackground()) return voiceFailure("background");
      if (voiceRequest) return voiceFailure("busy");
      voiceRequest = requestId;
      const result = await voice.start(requestId);
      if (!result.ok) {
        if (voiceRequest === requestId) voiceRequest = null;
        return result;
      }
      if (isBackground() || voiceRequest !== requestId) {
        await voice.cancel(requestId, "background");
        return voiceFailure("background");
      }
      return result;
    },
    async stopVoice(requestId) {
      if (!validRequestId(requestId)) return Promise.resolve(voiceFailure("invalid-request"));
      if (isBackground()) return voiceFailure("background");
      if (voiceRequest !== requestId) return voiceFailure("not-active");
      return voice.stop(requestId);
    },
    async cancelVoice(requestId, reason) {
      if (!validRequestId(requestId)) return Promise.resolve();
      if (voiceRequest === requestId) voiceRequest = null;
      return voice.cancel(requestId, reason);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      voiceRequest = null;
      input.dispose();
      voice.dispose();
      while (cleanups.length > 0) cleanups.pop()?.();
      subscribers.clear();
    },
  };
}

export function voiceFailure(error: VoiceError): VoiceActionResult {
  return { ok: false, error };
}
