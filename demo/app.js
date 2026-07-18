import { createDiagnosticLog } from "./lib/diagnostics.js";
import { createEvidenceCollector, deriveOriginClass } from "./lib/evidence.js";
import { createInputController } from "./lib/input-controller.js";
import { createInitialProbeState, reduceProbeState } from "./lib/probe-store.js";
import { createRabbitBridgeAdapter } from "./lib/rabbit-bridge-adapter.js";

const app = document.querySelector("#app");

const DEFAULT_BUDGETS = { diagnostics: { entries: 64, serializedBytes: 16384 } };
let budgets = DEFAULT_BUDGETS;
try {
  const budgetResponse = await fetch("./budgets.json");
  if (budgetResponse.ok) budgets = await budgetResponse.json();
} catch {
  // Non-fatal: fall back to defaults so the probe still renders and can report state.
  budgets = DEFAULT_BUDGETS;
}

const agents = [
  { title: "Creation probe", meta: "CODEX · RUNNING · ROOT" },
  { title: "Bridge diagnostics", meta: "DEVICE · CAPABILITY REPORT" },
  {
    title: "Transport check",
    meta: `${location.protocol.toUpperCase().replace(":", "")} · ${navigator.onLine ? "ONLINE" : "OFFLINE"}`,
  },
];

const diagnostics = createDiagnosticLog({
  capacity: budgets.diagnostics.entries,
  maxBytes: budgets.diagnostics.serializedBytes,
});
let state = createInitialProbeState({ itemCount: agents.length });
let activeVoiceRequest = null;
let mockVoiceRequest = null;
let requestSequence = 0;

function inputCommand(type) {
  if (["previous", "next", "select", "back"].includes(type)) return type;
  if (type === "focus-at") return "focus";
  if (type === "hold-start") return "voice-start";
  if (type === "hold-end" || type === "hold-limit") return "voice-stop";
  return "interrupt";
}

function ignoredCode(reason) {
  if (reason === "duplicate-hold-start" || reason === "orphan-hold-end") return "duplicate";
  if (reason === "trailing-click") return "late-click";
  if (reason === "hold-consumed") return "wrong-state";
  return "wrong-state";
}

function transcriptSizeBucket(value) {
  const size = typeof value === "string" ? value.length : 0;
  if (size === 0) return "empty";
  if (size <= 32) return "1-32";
  if (size <= 128) return "33-128";
  if (size <= 512) return "129-512";
  return "513+";
}

function dispatch(action) {
  state = reduceProbeState(state, action);
  render();
}

const controller = createInputController({
  emit: handleCommand,
  onIgnored(event) {
    diagnostics.record("input", {
      command: inputCommand(event.type),
      source: event.source,
      result: "ignored",
      code: ignoredCode(event.reason),
    });
  },
  // S01 fixture only. S02 must calibrate this against the tested firmware.
  lateClickSuppressionMs: 500,
});

const bridge = createRabbitBridgeAdapter({
  controller,
  onTranscript({ requestId, transcript }) {
    if (requestId !== activeVoiceRequest) return;
    activeVoiceRequest = null;
    diagnostics.record("voice", {
      state: "review",
      result: "received",
      sizeBucket: transcriptSizeBucket(transcript),
    });
    dispatch({ type: "voice-transcript", transcript });
  },
  onVoiceError({ requestId, code }) {
    if (requestId !== activeVoiceRequest) return;
    activeVoiceRequest = null;
    diagnostics.record("voice", {
      state: "failed",
      result: "failed",
      code: ["hidden", "timeout", "too-short", "unavailable"].includes(code) ? code : "bridge-error",
    });
    dispatch({ type: "voice-interrupted", reason: "bridge-error" });
  },
  onLifecycle(event) {
    diagnostics.record("lifecycle", {
      state: event.state,
      result: event.state === "background" ? "interrupted" : "observed",
    });
  },
});

function beginVoice(source) {
  if (state.view !== "home" || state.recording || state.transcribing) return;
  activeVoiceRequest = `probe-${++requestSequence}`;
  diagnostics.record("voice", { state: "recording", result: "started" });
  dispatch({ type: "voice-started", source });

  const result = bridge.startSpeech(activeVoiceRequest);
  if (result.ok) return;
  if (result.error === "unsupported") {
    mockVoiceRequest = activeVoiceRequest;
    return;
  }

  // The adapter reports bridge errors synchronously before returning.
  if (!activeVoiceRequest) return;

  activeVoiceRequest = null;
  diagnostics.record("voice", { state: "failed", result: "failed", code: "bridge-error" });
  dispatch({ type: "voice-interrupted", reason: "bridge-error" });
}

function finishVoice(event) {
  if (!state.recording || !activeVoiceRequest) return;

  if (event.tooShort) {
    const requestId = activeVoiceRequest;
    activeVoiceRequest = null;
    mockVoiceRequest = null;
    bridge.cancelSpeech(requestId, "too-short");
    diagnostics.record("voice", { state: "failed", result: "failed", code: "too-short" });
    dispatch({ type: "voice-interrupted", reason: "too-short" });
    return;
  }

  diagnostics.record("voice", { state: "transcribing", result: "stopped" });
  dispatch({ type: "voice-transcribing" });

  if (mockVoiceRequest === activeVoiceRequest) {
    const requestId = mockVoiceRequest;
    mockVoiceRequest = null;
    receiveMockTranscript(requestId);
    return;
  }
  bridge.stopSpeech(activeVoiceRequest);
}

function receiveMockTranscript(requestId) {
  if (requestId !== activeVoiceRequest) return;
  const transcript = "Show me the latest agent status.";
  activeVoiceRequest = null;
  diagnostics.record("voice", {
    state: "review",
    result: "received",
    sizeBucket: transcriptSizeBucket(transcript),
  });
  dispatch({ type: "voice-transcript", transcript });
}

function interruptVoice(event) {
  activeVoiceRequest = null;
  mockVoiceRequest = null;
  diagnostics.record("voice", {
    state: "failed",
    result: "interrupted",
    code: event.reason === "hidden" ? "hidden" : "bridge-error",
  });
  dispatch({ type: "voice-interrupted", reason: event.reason === "hidden" ? "hidden" : "interrupted" });
}

function handleCommand(event) {
  diagnostics.record("input", {
    command: inputCommand(event.type),
    source: event.source,
    result: event.type === "hold-interrupted" ? "interrupted" : "emitted",
  });

  if (event.type === "hold-start") {
    beginVoice(event.source);
    return;
  }
  if (event.type === "hold-end" || event.type === "hold-limit") {
    finishVoice(event);
    return;
  }
  if (event.type === "hold-interrupted") {
    interruptVoice(event);
    return;
  }

  dispatch({ type: event.type, focus: event.focus });
}

function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}

function renderHeader(title = "PASEO / PROBE") {
  return `<header class="header"><span class="brand">${title}</span><span class="connection">${navigator.onLine ? "LIVE" : "OFFLINE"}</span></header>`;
}

function renderHome() {
  app.innerHTML = `
    ${renderHeader()}
    <section class="context"><div class="eyebrow">MAC -> RABBITOS</div><div class="context-title">Creation development check</div></section>
    <section class="list" aria-label="Probe actions">
      ${agents.map((agent, index) => `
        <button class="row" type="button" data-index="${index}" aria-current="${state.focus === index}">
          <span class="row-title"><span class="dot"></span>${agent.title}</span>
          <span class="row-meta">${agent.meta}</span>
        </button>`).join("")}
    </section>
    <footer class="rail"><span>${state.focus + 1} / ${agents.length}</span><span><strong>HOLD</strong> TO SPEAK · CLICK OPEN</span></footer>`;

  app.querySelectorAll(".row").forEach((row) => {
    row.addEventListener("pointerup", () => {
      const focus = Number(row.dataset.index);
      if (state.focus === focus) bridge.sendInput("select", "touch");
      else bridge.sendInput("focus-at", "touch", { focus });
    });
  });
}

function renderDiagnostics() {
  const capabilities = bridge.capabilities();
  const rows = [
    ["VIEWPORT", capabilities.viewport, capabilities.viewport === "240x282"],
    ["HTTPS", capabilities.protocol.toUpperCase(), capabilities.protocol === "https"],
    ["VOICE BRIDGE", capabilities.voice ? "FOUND" : "MOCK", capabilities.voice],
    ["SECURE STORE", capabilities.secureStorage ? "FOUND" : "ABSENT", capabilities.secureStorage],
    ["SENSORS", capabilities.sensors ? "FOUND" : "ABSENT", capabilities.sensors],
    ["EVENTS", `${diagnostics.snapshot().length} CAPTURED`, true],
  ];
  app.innerHTML = `${renderHeader("CAPABILITIES")}
    <section class="screen">
      <h1>Bridge report</h1>
      <p class="screen-copy">Browser absences are expected. Scan the install QR to measure RabbitOS.</p>
      <ul class="diagnostics">${rows.map(([key, value, ok]) => `<li><span>${key}</span><strong class="${ok ? "yes" : "no"}">${value}</strong></li>`).join("")}</ul>
      <button class="back" type="button">&larr; BACK</button>
    </section>`;
  app.querySelector(".back").addEventListener("click", () => bridge.sendInput("back", "touch"));
}

function renderTransport() {
  app.innerHTML = `${renderHeader("TRANSPORT")}
    <section class="screen">
      <h1>${navigator.onLine ? "Network available" : "Offline"}</h1>
      <p class="screen-copy">Loaded over <strong>${location.protocol.replace(":", "").toUpperCase()}</strong>. A real Creation install requires a reachable HTTPS URL; backend sockets must use WSS.</p>
      <ul class="diagnostics">
        <li><span>HOST</span><strong>${location.hostname ? "LOCAL DEV" : "LOCAL FILE"}</strong></li>
        <li><span>ONLINE EVENT</span><strong class="yes">READY</strong></li>
        <li><span>APP VERSION</span><strong>S01</strong></li>
      </ul>
      <button class="back" type="button">&larr; BACK</button>
    </section>`;
  app.querySelector(".back").addEventListener("click", () => bridge.sendInput("back", "touch"));
}

function renderVoice() {
  app.innerHTML = `<section class="voice">
    <div><div class="voice-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
    <div class="voice-state">${state.transcribing ? "TRANSCRIBING" : "RECORDING"}</div>
    <div class="voice-note">${state.transcribing ? "WAIT FOR RESULT" : "RELEASE SIDE BUTTON"}</div></div>
  </section>`;
}

function renderComposer() {
  app.innerHTML = `${renderHeader("VOICE REVIEW")}
    <section class="screen">
      <h1>Transcript ready</h1>
      <p class="screen-copy">Review before accepting.</p>
      <div class="transcript">${escapeHtml(state.transcript)}</div>
      <div class="action-row"><span>BACK CANCEL</span><strong>CLICK ACCEPT</strong></div>
    </section>`;
}

function render() {
  app.dataset.view = state.view;
  if (state.view === "home") renderHome();
  else if (state.view === "diagnostics") renderDiagnostics();
  else if (state.view === "transport") renderTransport();
  else if (state.view === "voice") renderVoice();
  else if (state.view === "composer") renderComposer();

  diagnostics.record("navigation", {
    view: state.view,
    focus: state.focus,
    result: "entered",
  });
}

window.addEventListener("error", () => diagnostics.record("error", { kind: "runtime", code: "unhandled" }));
window.addEventListener("unhandledrejection", () => diagnostics.record("error", { kind: "rejection", code: "unhandled" }));
window.addEventListener("online", () => {
  diagnostics.record("network", { online: true, result: "online" });
  render();
});
window.addEventListener("offline", () => {
  diagnostics.record("network", { online: false, result: "offline" });
  render();
});
window.addEventListener("beforeunload", () => {
  bridge.dispose();
  controller.dispose();
}, { once: true });

diagnostics.record("boot", {
  source: typeof window.CreationVoiceHandler === "undefined" ? "browser" : "rabbit",
  width: innerWidth,
  height: innerHeight,
});

// S02 evidence capture: sanitized, bounded, payload-free. Headless (no DOM change);
// the export hook is exposed only with ?evidence for the owned-R1 UAT run. Wrapped so
// evidence capture can never block first paint or blank the screen.
let evidence = null;
try {
  const PROBE_VERSION = "s02-1";
  evidence = createEvidenceCollector({
    version: PROBE_VERSION,
    digest: document.querySelector('meta[name="probe-digest"]')?.content ?? "",
    originClass: deriveOriginClass(location),
  });
  const capabilities = bridge.capabilities();
  evidence.setFirmware("unknown"); // Tested-firmware is a human decision recorded on device.
  evidence.setViewport({
    width: innerWidth,
    height: innerHeight,
    orientation: innerWidth <= innerHeight ? "portrait" : "landscape",
  });
  evidence.setCapabilities({
    https: capabilities.protocol === "https",
    voice: Boolean(capabilities.voice),
    secureStorage: Boolean(capabilities.secureStorage),
    sensors: Boolean(capabilities.sensors),
  });
} catch {
  evidence = null;
}

const search = new URLSearchParams(location.search);
if (evidence && search.has("evidence")) {
  window.__probeEvidence = Object.freeze({
    export: () => evidence.export(),
    setFirmware: (status) => evidence.setFirmware(status),
    recordResult: (entry) => evidence.recordResult(entry),
    recordMeasurement: (key, value) => evidence.recordMeasurement(key, value),
    recordResourceSample: (sample) => evidence.recordResourceSample(sample),
    setProductMode: (mode) => evidence.setProductMode(mode),
    reset: () => evidence.reset(),
  });
}

if (search.has("debug")) {
  window.__probeDebug = Object.freeze({
    diagnostics: () => diagnostics.snapshot(),
  });
}

render();
