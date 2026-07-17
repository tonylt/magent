const app = document.querySelector("#app");

const state = {
  view: "home",
  focus: 0,
  recording: false,
  transcript: "",
  logs: [],
};

const agents = [
  { title: "Creation probe", meta: "CODEX · RUNNING · ROOT" },
  { title: "Bridge diagnostics", meta: "DEVICE · CAPABILITY REPORT" },
  { title: "Transport check", meta: `${location.protocol.toUpperCase().replace(":", "")} · ${navigator.onLine ? "ONLINE" : "OFFLINE"}` },
];

const capabilities = () => ({
  viewport: `${innerWidth}x${innerHeight}`,
  voice: typeof window.CreationVoiceHandler !== "undefined",
  secureStorage: Boolean(window.creationStorage?.secure),
  sensors: Boolean(window.creationSensors),
  protocol: location.protocol.replace(":", "") || "file",
});

function log(type, detail = "") {
  state.logs.push({ at: new Date().toISOString(), type, detail: String(detail).slice(0, 80) });
  state.logs = state.logs.slice(-30);
}

function renderHeader(title = "PASEO / PROBE") {
  return `<header class="header"><span class="brand">${title}</span><span class="connection">LIVE</span></header>`;
}

function renderHome() {
  app.innerHTML = `
    ${renderHeader()}
    <section class="context"><div class="eyebrow">MAC → RABBITOS</div><div class="context-title">Creation development check</div></section>
    <section class="list" role="listbox" aria-label="Probe actions">
      ${agents.map((agent, index) => `
        <button class="row" role="option" data-index="${index}" aria-current="${state.focus === index}" aria-selected="${state.focus === index}">
          <span class="row-title"><span class="dot"></span>${agent.title}</span>
          <span class="row-meta">${agent.meta}</span>
        </button>`).join("")}
    </section>
    <footer class="rail"><span>${state.focus + 1} / ${agents.length}</span><span><strong>HOLD</strong> TO SPEAK · CLICK OPEN</span></footer>`;

  app.querySelectorAll(".row").forEach((row) => {
    row.addEventListener("pointerup", () => {
      const index = Number(row.dataset.index);
      if (state.focus === index) select();
      else { state.focus = index; log("touch-focus", index); render(); }
    });
  });
}

function renderDiagnostics() {
  const caps = capabilities();
  const rows = [
    ["VIEWPORT", caps.viewport, caps.viewport === "240x282"],
    ["HTTPS", caps.protocol.toUpperCase(), caps.protocol === "https"],
    ["VOICE BRIDGE", caps.voice ? "FOUND" : "MOCK", caps.voice],
    ["SECURE STORE", caps.secureStorage ? "FOUND" : "ABSENT", caps.secureStorage],
    ["SENSORS", caps.sensors ? "FOUND" : "ABSENT", caps.sensors],
    ["EVENTS", `${state.logs.length} CAPTURED`, true],
  ];
  app.innerHTML = `${renderHeader("CAPABILITIES")}
    <section class="screen">
      <h1>Bridge report</h1>
      <p class="screen-copy">Browser absences are expected. Scan the install QR to measure RabbitOS.</p>
      <ul class="diagnostics">${rows.map(([key, value, ok]) => `<li><span>${key}</span><strong class="${ok ? "yes" : "no"}">${value}</strong></li>`).join("")}</ul>
      <button class="back" type="button">← BACK</button>
    </section>`;
  app.querySelector(".back").addEventListener("click", back);
}

function renderTransport() {
  app.innerHTML = `${renderHeader("TRANSPORT")}
    <section class="screen">
      <h1>${navigator.onLine ? "Network available" : "Offline"}</h1>
      <p class="screen-copy">Loaded over <strong>${location.protocol.replace(":", "").toUpperCase()}</strong>. A real Creation install requires a reachable HTTPS URL; backend sockets must use WSS.</p>
      <ul class="diagnostics">
        <li><span>HOST</span><strong>${location.hostname || "LOCAL FILE"}</strong></li>
        <li><span>ONLINE EVENT</span><strong class="yes">READY</strong></li>
        <li><span>APP VERSION</span><strong>DEMO-1</strong></li>
      </ul>
      <button class="back" type="button">← BACK</button>
    </section>`;
  app.querySelector(".back").addEventListener("click", back);
}

function renderVoice() {
  app.innerHTML = `<section class="voice">
    <div><div class="voice-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
    <div class="voice-state">LISTENING</div><div class="voice-note">RELEASE SIDE BUTTON</div></div>
  </section>`;
}

function renderComposer() {
  app.innerHTML = `${renderHeader("VOICE REVIEW")}
    <section class="screen">
      <h1>Transcript ready</h1>
      <p class="screen-copy">Review before sending.</p>
      <div class="transcript">${escapeHtml(state.transcript)}</div>
      <div class="action-row"><span>BACK CANCEL</span><strong>CLICK ACCEPT</strong></div>
    </section>`;
}

function escapeHtml(value) {
  const el = document.createElement("span");
  el.textContent = value;
  return el.innerHTML;
}

function render() {
  if (state.view === "home") renderHome();
  else if (state.view === "diagnostics") renderDiagnostics();
  else if (state.view === "transport") renderTransport();
  else if (state.view === "voice") renderVoice();
  else if (state.view === "composer") renderComposer();
}

function move(delta) {
  if (state.view !== "home") return;
  state.focus = Math.max(0, Math.min(agents.length - 1, state.focus + delta));
  log("focus", state.focus);
  render();
}

function select() {
  log("select", state.focus);
  if (state.view === "composer") {
    state.view = "home";
    state.transcript = "";
  } else if (state.view === "home" && state.focus === 1) state.view = "diagnostics";
  else if (state.view === "home" && state.focus === 2) state.view = "transport";
  else if (state.view === "home") state.view = "diagnostics";
  render();
}

function back() {
  log("back", state.view);
  state.view = "home";
  state.recording = false;
  render();
}

function startVoice() {
  if (state.view !== "home" || state.recording) return;
  state.recording = true;
  state.view = "voice";
  log("voice-start", capabilities().voice ? "native" : "mock");
  render();
  window.CreationVoiceHandler?.postMessage("start");
}

function stopVoice() {
  if (!state.recording) return;
  state.recording = false;
  log("voice-stop");
  if (capabilities().voice) {
    window.CreationVoiceHandler.postMessage("stop");
    app.querySelector(".voice-state").textContent = "TRANSCRIBING";
  } else {
    receiveTranscript("Show me the latest agent status.");
  }
}

function receiveTranscript(transcript) {
  state.recording = false;
  state.transcript = transcript.trim();
  state.view = "composer";
  log("transcript", `${state.transcript.length} chars`);
  render();
}

window.onPluginMessage = (message) => {
  if (message?.type === "sttEnded") receiveTranscript(message.transcript || "");
};

const hardwareMap = {
  scrollUp: () => move(-1),
  scrollDown: () => move(1),
  sideClick: select,
  longPressStart: startVoice,
  longPressEnd: stopVoice,
};

Object.entries(hardwareMap).forEach(([event, handler]) => window.addEventListener(event, handler));

document.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  if (event.key === "ArrowUp") move(-1);
  else if (event.key === "ArrowDown") move(1);
  else if (event.key === "Enter") select();
  else if (event.key === "Escape" || event.key === "Backspace") back();
  else if (event.key === " ") { event.preventDefault(); startVoice(); }
});

document.addEventListener("keyup", (event) => {
  if (event.key === " ") { event.preventDefault(); stopVoice(); }
});

window.addEventListener("error", (event) => log("error", event.message));
window.addEventListener("unhandledrejection", (event) => log("rejection", event.reason));
window.addEventListener("online", () => { log("online"); render(); });
window.addEventListener("offline", () => { log("offline"); render(); });

log("boot", JSON.stringify(capabilities()));
render();
