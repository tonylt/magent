# Rabbit R1 Creation WebView on macOS

Date: 2026-07-17

## Conclusion

Rabbit R1 Creation development is ordinary small-screen web development plus a RabbitOS-injected JavaScript bridge. A Mac needs Node.js, a browser, an HTTPS hosting path, and a QR generator. It does not need Android Studio or ADB for the normal Creation workflow.

Use the desktop browser for layout, state, transport, and input-controller tests. Use a real R1 for the RabbitOS bridge, speech-to-text, storage compatibility, wheel timing, side-button timing, suspend/resume behavior, and final performance checks.

## What Runs Where

```text
Mac
  source + dev server
       |
       | HTTPS (publicly reachable URL)
       v
RabbitOS Creation WebView (240x282 CSS px)
  RabbitOS injects hardware events and native bridge objects
       |
       | HTTPS / WSS
       v
Application backend or Paseo gateway
```

A Creation is installed from a QR payload that points to a hosted web URL. It is not an APK and is not installed with `adb install`.

## Verified Community Contract

The following behavior is present in the inspected `rabbit-r1-creations-public` examples at commit `8c45dff28d29687c7a91e835f397878f11d36b3e` (2026-04-27). Treat it as a community-observed contract, not a stable official browser standard. Feature-detect every API on the target firmware.

### Viewport

```html
<meta name="viewport" content="width=240, initial-scale=1.0, user-scalable=no">
```

The app surface is fixed at 240 by 282 CSS pixels. Keep the body bounded and avoid relying on native body scrolling.

```css
html, body {
  width: 240px;
  height: 282px;
  margin: 0;
  overflow: hidden;
}
```

### Hardware Events

RabbitOS dispatches these events on `window`:

| Event | Meaning |
|---|---|
| `scrollUp` | Wheel moved up |
| `scrollDown` | Wheel moved down |
| `sideClick` | Short side-button press |
| `longPressStart` | Side-button hold started |
| `longPressEnd` | Side-button hold released |

Do not equate event names with visual direction without testing the target firmware. Normalize them once in an input adapter, then expose application commands such as `focusPrevious`, `focusNext`, `select`, `holdStart`, and `holdEnd`.

### Speech-to-Text

```js
if (typeof CreationVoiceHandler !== "undefined") {
  CreationVoiceHandler.postMessage("start");
  // On release:
  CreationVoiceHandler.postMessage("stop");
}

window.onPluginMessage = (message) => {
  if (message?.type === "sttEnded") {
    const transcript = (message.transcript || "").trim();
  }
};
```

Native STT only works on a real R1. Desktop tests should inject a fake transcript into the same application callback. Do not automatically send a returned transcript; present it for review first.

### Storage

`localStorage` works for non-sensitive state. Community examples report the async storage API below on newer firmware:

```js
const storage = window.creationStorage;
await storage.secure.setItem("device-token", btoa(token));
const raw = await storage.secure.getItem("device-token");
const token = raw ? atob(raw) : null;
```

Values must be Base64 encoded. Check that `window.creationStorage?.secure` exists and provide a pairing fallback when it does not. Never put provider credentials in the Creation.

### Touch and Keyboard

Community examples warn that `touchstart` combined with broad `preventDefault()` calls can destabilize the R1 WebView. Prefer `pointerdown` / `pointerup`, avoid document-wide touch cancellation, reveal the input before calling `focus()`, and call `blur()` when closing it.

## Mac Setup

The current Mac already has Node.js 24 and npm 11. A minimal project can use Vite, but a build-free static app also works.

```bash
npm create vite@latest creation-client -- --template vanilla-ts
cd creation-client
npm install
npm run dev -- --host 0.0.0.0
```

For this repository, the existing prototype can be served without installing dependencies:

```bash
cd /Users/tony/workspace/ai/rabbit-r1-os/.worktrees/creation-webview-mac
npx serve .
```

The local URL is useful for desktop testing, but an R1 cannot install a Creation from `localhost` on the Mac. The device needs an HTTPS URL it can reach.

## HTTPS Development Paths

### Fast Iteration: HTTPS Tunnel

Run the local server, then expose it with a tunnel such as Cloudflare Tunnel or ngrok:

```bash
cloudflared tunnel --url http://localhost:5173
```

Use the generated `https://...` URL as the Creation URL. A quick tunnel URL may change when restarted, which requires generating and scanning a new install QR. It is appropriate for a spike, not a stable release.

Do not expose an unauthenticated Paseo daemon through a tunnel. The static client and a narrow development gateway should be the only exposed surfaces.

### Stable Testing: Static Hosting

For repeatable device testing, publish the static output to GitHub Pages, Netlify, Cloudflare Pages, or an equivalent HTTPS host:

```bash
npm run build
```

Publish `dist/` and use an immutable or versioned URL. Static hosting is the preferred route once hardware testing becomes routine.

## Creation Install QR

The inspected community examples encode JSON directly in the QR:

```json
{
  "title": "Paseo",
  "url": "https://example.com/r1/?v=1",
  "description": "Paseo agent remote for Rabbit R1",
  "iconUrl": "",
  "themeColor": "#FF4F18"
}
```

An installation page can render it with a QR library:

```html
<div id="qr"></div>
<script src="https://unpkg.com/qr-code-styling@1.6.0/lib/qr-code-styling.js"></script>
<script>
  const payload = JSON.stringify({
    title: "Paseo",
    url: "https://example.com/r1/?v=1",
    description: "Paseo agent remote for Rabbit R1",
    iconUrl: "",
    themeColor: "#FF4F18"
  });
  new QRCodeStyling({ width: 260, height: 260, data: payload })
    .append(document.getElementById("qr"));
</script>
```

Open the installation page on the Mac and scan the QR with the R1 camera. The install QR and application pairing are separate: the former installs a URL, while the latter grants scoped access to a backend.

## Cache Busting

RabbitOS caches a Creation by its install URL. After changing deployed code, increment a query parameter or publish a new immutable path:

```text
https://example.com/r1/?v=1
https://example.com/r1/?v=2
```

Regenerate and rescan the QR when the URL changes. Avoid relying only on normal browser cache headers during device iteration.

## Desktop Bridge Adapter

Keep RabbitOS globals out of view components. One adapter should translate real events and desktop keys into the same semantic commands:

```ts
type InputCommand =
  | "previous"
  | "next"
  | "select"
  | "hold-start"
  | "hold-end"
  | "back";

export function attachInput(emit: (command: InputCommand) => void) {
  const eventMap: Record<string, InputCommand> = {
    scrollUp: "previous",
    scrollDown: "next",
    sideClick: "select",
    longPressStart: "hold-start",
    longPressEnd: "hold-end",
  };

  for (const [event, command] of Object.entries(eventMap)) {
    window.addEventListener(event, () => emit(command));
  }

  window.addEventListener("keydown", (event) => {
    if (event.repeat) return;
    if (event.key === "ArrowUp") emit("previous");
    if (event.key === "ArrowDown") emit("next");
    if (event.key === "Enter") emit("select");
    if (event.key === "Escape" || event.key === "Backspace") emit("back");
    if (event.key === " ") emit("hold-start");
  });

  window.addEventListener("keyup", (event) => {
    if (event.key === " ") emit("hold-end");
  });
}
```

For speech, expose a `startSpeech`, `stopSpeech`, and `deliverTranscript` boundary. The browser mock calls `deliverTranscript("test text")`; the real adapter calls it for `sttEnded`.

## Debugging Without ADB

Because stock RabbitOS does not expose a normal USB-debugging workflow, build diagnostics into development versions of the Creation:

1. Maintain a bounded in-memory ring buffer, for example the latest 100 structured events.
2. Record app version, firmware-reported capabilities if available, connection state, bridge events, and sanitized errors.
3. Never log tokens, prompts, transcripts, provider credentials, or full backend payloads.
4. Provide a development-only diagnostics screen reachable by a deliberate gesture or query flag.
5. Optionally POST redacted logs to an authenticated development endpoint.
6. Add global `error` and `unhandledrejection` handlers, but bound message size and redact URLs/query parameters.

Useful capability output:

```js
const capabilities = {
  voice: typeof CreationVoiceHandler !== "undefined",
  pluginMessages: typeof PluginMessageHandler !== "undefined",
  secureStorage: Boolean(window.creationStorage?.secure),
  sensors: Boolean(window.creationSensors),
  online: navigator.onLine,
  viewport: `${innerWidth}x${innerHeight}`,
};
```

## Verification Matrix

| Area | Mac browser | Real R1 required |
|---|---:|---:|
| 240x282 layout and screenshots | Yes | Final check |
| Keyboard input mapping | Yes | No |
| Store and state machines | Yes | No |
| HTTPS/WSS transport | Yes | Final check |
| Wheel and side-button semantics | Simulated | Yes |
| Native speech-to-text | Mock only | Yes |
| Secure Creation storage | Mock only | Yes |
| WebView suspend/resume | Partial | Yes |
| Font metrics and on-screen keyboard | Approximate | Yes |
| Performance and battery behavior | No | Yes |

Use browser automation at an exact 240 by 282 viewport. Hardware release gates should include fresh QR install, cache-busted upgrade, offline recovery, page suspend/resume, rapid wheel input, side-button hold/release, STT failure, and a 30-minute bounded-resource run.

## Recommended Paseo Development Sequence

1. Extract a small TypeScript bridge adapter and input controller from the existing prototype.
2. Add desktop mocks and exact 240x282 automated screenshots.
3. Add a development diagnostics screen and bounded sanitized event log.
4. Serve the static client locally and expose it through a temporary HTTPS tunnel.
5. Generate a JSON install QR with a versioned URL and install it on stock RabbitOS.
6. Record the target RabbitOS version and verify wheel, side button, STT, storage, HTTPS, and WSS individually.
7. Test the existing Paseo browser transport through a narrow development gateway.
8. Move to stable versioned static hosting after the device spike.
9. Keep ADB and custom firmware outside scope unless a measured Creation limitation blocks a required workflow.

## Executable Validation Demo

The repository now includes `demo/`, a build-free Creation probe implementing the workflow described above:

- `demo/index.html`: 240x282 Creation entry point.
- `demo/app.js`: RabbitOS event adapter, desktop fallbacks, capability report, bounded diagnostics, and native/mock STT flow.
- `demo/install.html`: JSON Creation payload and generated install QR.
- `demo/README.md`: local run and deployment instructions.

Run it from this worktree with:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173/demo/` and `http://localhost:4173/demo/install.html`. Browser validation on 2026-07-17 confirmed an exact 240x282 viewport with no document overflow, semantic focus movement from a `scrollDown` event, navigation from a `sideClick` event, mock transcript review from `longPressStart`/`longPressEnd`, and QR rendering with a versioned `?v=1` application URL. HTTPS and native bridge results remain real-device checks.

## Risks and Open Questions

- RabbitOS bridge behavior is firmware-dependent and lacks a stable public compatibility guarantee.
- Community code disagrees in places about wheel direction; normalize after measuring the owned device.
- Native STT cannot be validated on macOS.
- Secure storage availability and persistence across reinstall need a target-device test.
- Remote WebView inspection is not assumed available on stock RabbitOS.
- HTTPS tunnel URLs may change and may introduce third-party trust or privacy concerns.
- WSS origin policy, pairing credentials, and Paseo protocol size still need a real Creation compatibility spike.

## Sources

- Existing project design: `docs/rabbit-r1-paseo-client-design.zh-CN.md`
- Existing UI/UX design: `docs/rabbit-r1-paseo-ui-ux.zh-CN.md`
- Rabbit R1 community examples: <https://github.com/andr3w-hilton/rabbit-r1-creations-public>
- R1 UI Kit: <https://github.com/Ashosystem/r1-ui-kit>
- R1 Escape, consulted only to distinguish Creation development from custom firmware: <https://github.com/RabbitHoleEscapeR1/r1_escape>
