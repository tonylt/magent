# Rabbit R1 Paseo Client

This repository contains the design and future implementation of a Rabbit R1 client for Paseo.

The first release targets RabbitOS Creations: a small WebView application installed by QR code and connected to a remotely reachable Paseo daemon or relay. Custom Android firmware is intentionally outside the initial scope.

## Documentation

- [Solution design (English)](docs/rabbit-r1-paseo-client-design.md)
- [方案设计（简体中文）](docs/rabbit-r1-paseo-client-design.zh-CN.md)
- [UI/UX 设计（简体中文）](docs/rabbit-r1-paseo-ui-ux.zh-CN.md)
- [Design system](DESIGN.md)
- [Interactive prototype](prototype/index.html)

## Prototype

Open `prototype/index.html` directly in a browser. The app viewport remains fixed at 240x282 CSS pixels.

- Arrow Up / Down: wheel one semantic item
- Enter: side click
- Hold / release Space: dictation from an open Agent
- Escape / Backspace: browser-only back fallback
- `O`: toggle live/stale connection state
- `A`: acknowledge a pending Stop
- `F`: reject or fail a pending Stop
- `V`: make the next dictation fail
- `S`: make the next send fail

Review individual states with `?screen=home|workspace|agent|actions|permission|select|unsupported|stop|stopping|stop-failed|composer|voice|transcribing|voice-failed|send-failed|stale`.
