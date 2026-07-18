const NATIVE_INPUTS = {
  scrollUp: "previous",
  scrollDown: "next",
  sideClick: "select",
  longPressStart: "hold-start",
  longPressEnd: "hold-end",
};

function defaultCapabilities(host, document) {
  return Object.freeze({
    voice: typeof host.CreationVoiceHandler?.postMessage === "function",
    secureStorage: Boolean(host.creationStorage?.secure),
    sensors: Boolean(host.creationSensors),
    viewport: `${host.innerWidth ?? 0}x${host.innerHeight ?? 0}`,
    protocol: host.location?.protocol?.replace(":", "") || "file",
    lifecycle: Boolean(document?.addEventListener),
  });
}

export function createRabbitBridgeAdapter({
  host = globalThis.window,
  document = host?.document,
  controller,
  onInput,
  onTranscript = () => {},
  onVoiceError = () => {},
  onLifecycle = () => {},
} = {}) {
  if (!host?.addEventListener || !host?.removeEventListener) {
    throw new TypeError("host must provide DOM event methods");
  }

  const dispatchInput = typeof onInput === "function"
    ? onInput
    : (type, source) => controller?.handle(type, source);
  if (typeof onInput !== "function" && typeof controller?.handle !== "function") {
    throw new TypeError("onInput or controller.handle is required");
  }

  const cleanups = [];
  const previousPluginMessage = host.onPluginMessage;
  let activeVoiceRequest = null;
  let disposed = false;
  let lifecycleState = document?.visibilityState === "hidden" ? "background" : "foreground";
  let nextRequestId = 1;

  function dispatchWhenForeground(type, source, details) {
    if (disposed || lifecycleState === "background") return false;
    dispatchInput(type, source, details);
    return true;
  }

  function listen(target, type, listener) {
    target?.addEventListener?.(type, listener);
    cleanups.push(() => target?.removeEventListener?.(type, listener));
  }

  for (const [nativeEvent, command] of Object.entries(NATIVE_INPUTS)) {
    listen(host, nativeEvent, () => dispatchWhenForeground(command, "rabbit"));
  }

  function handleKeyDown(event) {
    if (event.repeat) return;
    if (event.key === "ArrowUp") dispatchWhenForeground("previous", "keyboard");
    else if (event.key === "ArrowDown") dispatchWhenForeground("next", "keyboard");
    else if (event.key === "Enter") dispatchWhenForeground("select", "keyboard");
    else if (event.key === "Escape" || event.key === "Backspace") dispatchWhenForeground("back", "keyboard");
    else if (event.key === " ") {
      event.preventDefault?.();
      dispatchWhenForeground("hold-start", "keyboard");
    }
  }

  function handleKeyUp(event) {
    if (event.key !== " ") return;
    event.preventDefault?.();
    dispatchWhenForeground("hold-end", "keyboard");
  }

  listen(document, "keydown", handleKeyDown);
  listen(document, "keyup", handleKeyUp);

  function transitionLifecycle(state, cause) {
    if (disposed || lifecycleState === state) return;
    lifecycleState = state;
    if (state === "background") {
      controller?.interrupt?.(cause);
      if (activeVoiceRequest) cancelSpeech(activeVoiceRequest, cause);
    }
    onLifecycle({ type: "lifecycle", state, cause });
  }

  listen(document, "visibilitychange", () => {
    transitionLifecycle(document.visibilityState === "hidden" ? "background" : "foreground", "visibility");
  });
  listen(host, "pagehide", () => transitionLifecycle("background", "pagehide"));
  listen(host, "pageshow", () => transitionLifecycle("foreground", "pageshow"));

  function pluginMessage(message) {
    if (typeof previousPluginMessage === "function") {
      try {
        previousPluginMessage.call(host, message);
      } catch {
        // A pre-existing observer must not prevent delivery to this adapter.
      }
    }
    if (disposed || message?.type !== "sttEnded" || !activeVoiceRequest) return;

    const requestId = activeVoiceRequest;
    activeVoiceRequest = null;
    const transcript = typeof message.transcript === "string" ? message.transcript.trim() : "";
    if (transcript) onTranscript({ requestId, transcript });
    else onVoiceError({ requestId, code: "empty-transcript" });
  }

  host.onPluginMessage = pluginMessage;

  function startSpeech(requestId = `voice-${nextRequestId++}`) {
    if (disposed) return { ok: false, error: "disposed" };
    if (activeVoiceRequest) return { ok: false, error: "busy" };
    const voice = host.CreationVoiceHandler;
    if (typeof voice?.postMessage !== "function") return { ok: false, error: "unsupported" };

    activeVoiceRequest = requestId;
    try {
      voice.postMessage("start");
      return { ok: true, requestId };
    } catch {
      activeVoiceRequest = null;
      onVoiceError({ requestId, code: "start-failed" });
      return { ok: false, error: "bridge-error" };
    }
  }

  function stopSpeech(requestId = activeVoiceRequest) {
    if (disposed) return { ok: false, error: "disposed" };
    if (!activeVoiceRequest || requestId !== activeVoiceRequest) {
      return { ok: false, error: "not-active" };
    }
    try {
      host.CreationVoiceHandler.postMessage("stop");
      return { ok: true, requestId };
    } catch {
      activeVoiceRequest = null;
      onVoiceError({ requestId, code: "stop-failed" });
      return { ok: false, error: "bridge-error" };
    }
  }

  function cancelSpeech(requestId = activeVoiceRequest, reason = "interrupted") {
    if (!activeVoiceRequest || requestId !== activeVoiceRequest) return false;
    try {
      host.CreationVoiceHandler?.postMessage?.("stop");
    } catch {
      // Interruption is already terminal; bridge cleanup is best effort.
    }
    activeVoiceRequest = null;
    onVoiceError({ requestId, code: reason });
    return true;
  }

  function dispose() {
    if (disposed) return;
    if (activeVoiceRequest) {
      try {
        host.CreationVoiceHandler?.postMessage?.("stop");
      } catch {
        // Native cleanup is best effort during teardown.
      }
      activeVoiceRequest = null;
    }
    disposed = true;
    while (cleanups.length) cleanups.pop()();
    if (host.onPluginMessage === pluginMessage) {
      if (previousPluginMessage === undefined) delete host.onPluginMessage;
      else host.onPluginMessage = previousPluginMessage;
    }
  }

  return {
    capabilities: () => defaultCapabilities(host, document),
    startSpeech,
    stopSpeech,
    cancelSpeech,
    sendInput: dispatchWhenForeground,
    dispose,
    isVoiceActive: () => Boolean(activeVoiceRequest),
  };
}
