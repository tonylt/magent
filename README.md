# Rabbit R1 Paseo Client

This repository contains the design and future implementation of a Rabbit R1 client for Paseo.

The first release targets RabbitOS Creations: a small WebView application installed by QR code and connected to a Paseo daemon through the end-to-end encrypted Paseo Relay. Direct/LAN connections remain development-only, and custom Android firmware is outside the initial scope.

## Documentation

- [产品设计（简体中文）](docs/rabbit-r1-paseo-product-design.zh-CN.md)
- [Solution design (English)](docs/rabbit-r1-paseo-client-design.md)
- [方案设计（简体中文）](docs/rabbit-r1-paseo-client-design.zh-CN.md)
- [UI/UX 设计（简体中文）](docs/rabbit-r1-paseo-ui-ux.zh-CN.md)
- [产品设计迭代审查（简体中文）](docs/rabbit-r1-paseo-design-review.zh-CN.md)
- [Design system](DESIGN.md)
- [Interactive prototype](prototype/index.html)

## Prototype

Open `prototype/index.html` directly in a browser. The app viewport remains fixed at 240x282 CSS pixels.

The prototype demonstrates the confirmed Phase 2 interaction contract. Tested firmware, Device grant, device lock, command reconciliation, and turn-safe Stop are simulated capability states; their presence in the prototype does not imply that the current Paseo backend implements them.

- Arrow Up / Down: wheel one semantic item
- Enter: side click
- Hold / release Space: dictation from an open Agent
- Escape / Backspace: browser-only back fallback
- `O`: simulate `LIVE → STALE → SYNCING`; it never bypasses reconciliation
- `R`: complete the simulated directory/timeline reconciliation and revalidate the Device grant/session
- `A`: acknowledge a pending Stop
- `F`: reject or fail a pending Stop
- `C`: confirm an accepted Follow-up from the authoritative timeline
- `U`: make an accepted Follow-up indeterminate (`UNKNOWN`)
- `V`: make the next dictation fail
- `S`: make the next send fail

Review individual states with `?screen=home|attention-overflow|pairing|pairing-progress|pair-failed|paired|first-load|connecting|syncing|stale|auth-required|revoked|security-blocked|limited|firmware-unsupported|workspace|related-workspace|agent|subagents|child-agent|actions|permission|grant-required|device-lock-required|host-mismatch|session-expired|foreign-draft|composer|voice|transcribing|voice-failed|send-failed|unknown|stop|stop-grant-required|stopping|stop-failed|turn-changed`.
