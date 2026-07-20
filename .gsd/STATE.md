# Rabbit R1 Paseo Companion Execution State

Last updated: 2026-07-20

## Current Position

- **Active milestone: M002 — Mobile Paseo Companion (UX-differentiated MVP)**, Expo/React Native/TypeScript under `mobile/`. Thesis: away-from-desk triage/intervention with attention-first UX. Backend daemon available; UX-first with mock data, then wired. See `.gsd/milestones/M002/M002-PRD.md`.
- **M001 (Rabbit R1) is PAUSED** due to device friction (no on-device console, side-button long-press likely OS-reserved, viewport/cert/cache friction). Reusable assets carry over: `CONTEXT.md` domain model, `DESIGN.md`, safety principles, and the S04 Relay contract.
- M001 completed slices before pause: S01, S03, S04, S11 (+ S12 release path, S02 in progress).

## M002 Progress

- Scaffolded Expo SDK 57 + React Native 0.86 + React 19 + TypeScript under `mobile/` (blank-typescript) with React Navigation native-stack.
- M2-S01: dark mobile theme tokens; pure domain types + selectors (attention ranking permission>error>finished then recency, freshness/actionability, target-bound Draft, timeAgo) with 6 Node unit tests; `PaseoRepository` interface + deterministic mock data + shared instance.
- Flagship + loop screens (mock): Attention Home (ranked cards, host/freshness header, pull-to-refresh, empty state), Workspaces/Agent list, Agent timeline (freshness-gated Follow-up), Follow-up Composer (hold-to-dictate mock, review-before-send, never auto-sends, Draft bound to Agent), Permission read-only handoff.
- Verified: `npm test` (6 pass) and `npm run typecheck` (clean) in `mobile/`. Runtime preview via `expo start` (Expo Go / web) — not run in this environment.
- M2-S05 (real data): adopted official `@getpaseo/client@0.1.100` (matched to the user's daemon). `src/data/paseo/daemon.ts` parses the pairing offer, connects over relay E2EE (`DaemonClient` + `buildRelayWebSocketUrl`), and maps `fetchWorkspaces`/`fetchAgents`/`fetchAgentTimeline` to domain types; attention derived from agent `requiresAttention`/`attentionReason`. `instance.ts` is a mock↔daemon store; added a Connect screen (paste offer URL) and Home connection state + focus reload. RN polyfills (`react-native-get-random-values`, base-64 atob/btoa) in `index.ts`. Typecheck clean against the real SDK; on-device connect to the daemon not yet verified.
- Next: verify connect on device; wire Follow-up `.send()`; timeline mapping refinement; live subscriptions/freshness reconciliation; design-review polish (M2-S06).

## M2-S05 verified on device (2026-07-20)

Connected the mobile app to the user's real Paseo daemon over relay E2EE and rendered
real data (12 agents / 11 workspaces). Fixes needed during on-device bring-up:
- Expo Go compatibility: downgraded to SDK 54.
- `@getpaseo/relay` broken `exports` (src not shipped) -> Metro alias to `dist`.
- Hermes polyfills in `index.ts`: `atob/btoa` (base-64) and, critically,
  `crypto.randomUUID` (SDK RPC ids) built from `getRandomValues`.
- `fetchAgents`/`fetchWorkspaces` require `page`/`sort`; empty otherwise.
- Workspaces derived from agents when the daemon returns no workspace rows.
- No-op SDK logger + redacted connect errors so the offer never hits logs.
- Deduped the per-load agents fetch (1.5s cache).

Remaining M2-S05/M2-S06: persistence + auto-reconnect (offer in expo-secure-store),
timeline mapping refinement, Follow-up `.send()`, live subscriptions/freshness,
design-review polish.

## M001 Recent Progress (paused)

- `66e0e47` established the approved product, architecture, UI/UX, ADR, prototype, design-review evidence, and M001 roadmap baseline.
- `f31ee84` defined the S01 deterministic unit and browser contracts.
- `af2c4d6` wired the static probe through semantic input, Rabbit bridge, pure store, sanitized diagnostics, budgets, and fixed screenshots.
- `4751e03` created the separate TypeScript production Creation shell, DOM view, loopback browser fixture, Rabbit adapter selection, and reproducible esbuild artifact.
- `7f7388b` enforced source boundaries, static output allowlists, local-only dependencies, byte/DOM budgets, and fixed production screenshots.
- `46974df` made canceled native voice drain terminal-bound and routed touch detail commands through the shared adapter path.
- `0e543e0` recorded S03 production shell completion.
- S04 pinned the Relay `hello`/`offer`/`subscribe`/`frame` subset into a pure contract, a transport boundary, a compatibility tracer, and fixtures that fail visibly on any drift, without opening a real network or shipping in the default bundle.
- S11 merged the S04 tracer and the S03 device gate into one boot-time fail-closed negotiation, added a `CHECKING RELAY` transition and a recoverable `UPGRADE REQUIRED`/`UNSUPPORTED` recovery screen with retry, and advanced the ready state to `RELAY COMPATIBLE` — all driven by S04 fixtures over a loopback `?relay=` source, still exposing no product data.
- S02 automated preparation: added a LAN HTTPS probe host (`scripts/make-dev-cert.sh`, `npm run serve:lan`) and a sanitized, bounded, payload-free evidence collector (`demo/lib/evidence.js`) with an on-device `?evidence` capture hook and 9 unit tests. S02 stays `awaiting_hardware` — owned-R1 results are still required.
- Owned-R1 finding: a LAN self-signed cert is rejected by the R1 WebView (black screen, no error UI) — recorded as an H19 observation. Switched to GitHub Pages for a publicly trusted origin: added `.github/workflows/pages.yml` to publish `demo/` and made the probe boot fail-visibly. Owner will run the matrix on another device.
- The R1 cannot use `chrome://inspect`, so added an on-device UAT recorder to the probe (a 4th Home item): wheel moves H01–H24, side-click cycles PENDING/PASS/FALLBACK/BLOCKER, results mirror into the sanitized evidence collector, and the screen shows viewport/voice/secure-storage — screenshots are the redacted evidence. Probe installs and runs over GitHub Pages (H01/H19 observed).
- Owned-R1 capability observations: VOICE FOUND and SECURE STORE FOUND (Controlled-Action path is plausible pending device lock H18); measured viewport is 240x292, not the assumed 240x282. Retargeted the fixed canvas 282->292 across CSS, playwright config, unit/browser tests, budgets, prototype, README/DESIGN/design docs, and regenerated all 8 screenshot baselines; full verify green. Demo assets bumped (styles.css?v=4, app.js?v=6, install ?v=7).
- S12 increment 1: immutable versioned release packaging (`dist/r1/v<version>/`) with a deterministic `release.json` audit manifest and an independent `verify:release` (digests, CSP, no remote/dynamic imports); 5 unit tests. Additive over the unchanged S03 pipeline.
- S12 increment 2: vendored install QR — `qrcode-generator@1.4.4` (pinned, zero-dep) generates an inline-SVG, script-free, strict-CSP `install.html` at build time (no runtime CDN); 5 install-page unit tests. Remaining S12: Pages publish of the release and on-device reproducible install (HITL).

## Execution Rules

- Commit each completed slice separately and record its verification evidence in the matching `Sxx-SUMMARY.md`.
- Do not mark a HITL slice complete from browser mocks or fixtures.
- Keep the roadmap direction stable; small implementation adjustments must be documented in the relevant summary.
- Do not expose the daemon through public temporary tunnels without explicit user approval.
- When running `npm run verify`, free TCP port 4173 first (`lsof -ti tcp:4173 | xargs kill -9`) so the two back-to-back Playwright web servers do not collide; this is an environment concern, not a code failure.

## Next Gate

S02 requires owned-R1 evidence and cannot be completed automatically; S05 depends on S02 and S04. With S04 and S11 complete, the next autonomous work is S12 (immutable audited Creation release path, `depends:[S03]`), whose AFK parts (versioned immutable URL, vendored QR, strict CSP, dependency pinning, audit digest, cache-busted upgrade) can proceed against fixtures; its fresh-install-on-R1 confirmation is HITL and needs the owned device.
