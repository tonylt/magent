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

## Development and verification

```bash
npm ci
npm run verify          # S01 probe + production unit tests, budgets, source/output boundary, browser
npm run build           # bundle the production shell to dist/production
npm run release         # package an immutable versioned release to dist/r1/v<version>/ + install.html
npm run verify:release  # re-verify the release (digests, strict CSP, no remote/dynamic imports)
```

Layout:

- `demo/` — the S02 owned-R1 capability probe (installed on the device).
- `src/production/` — the production Creation shell, platform adapters, capability gate, and the pinned Relay compatibility tracer/negotiation.
- `scripts/` — build, immutable-release packaging/verification, and the LAN HTTPS dev server.
- `.gsd/` — milestone roadmap, per-slice plans/summaries, and execution state.

## Real-device testing on Rabbit R1 (S02)

RabbitOS Creations install only from a trusted HTTPS origin. A LAN self-signed
certificate is rejected by the R1 WebView and shows a black screen (recorded as
H19), so use GitHub Pages, which serves a publicly trusted certificate. The probe
holds no secrets and reaches no daemon, so public static hosting is safe.

One-time setup:

1. On GitHub, open **Settings → Pages** for `tonylt/magent` and set **Source: GitHub Actions**.
2. The `Deploy to GitHub Pages` workflow publishes the probe (`demo/`) at the site root
   and the immutable production release at `/r1/v<version>/` on each push to `main`
   (or run it manually from the **Actions** tab).

Per device:

1. Open `https://tonylt.github.io/magent/install.html` in a browser and scan the QR with
   Rabbit R1 Creations. Bump `?v=` in `demo/install.html` after each deploy to bust the
   Creation URL cache.
2. Open the app with `https://tonylt.github.io/magent/?evidence=1` to expose the sanitized
   `window.__probeEvidence` capture hook. Run the H01–H24 matrix in
   [`.gsd/milestones/M001/S02-HARDWARE-UAT.md`](.gsd/milestones/M001/S02-HARDWARE-UAT.md),
   then save the redacted `__probeEvidence.export()` bundle under `artifacts/hardware/s02/`.

The evidence export is allowlist-validated and payload-free (no token, transcript, raw
audio, URL, credential, Device ID, network address, or Relay offer). For a LAN
alternative and full details, see [`demo/README.md`](demo/README.md).
