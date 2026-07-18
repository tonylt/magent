---
milestone: M001
slice: S11
title: Capability and minimum-client fail-closed negotiation
type: tdd
wave: 3
depends_on: [S04]
status: complete
completed: 2026-07-18
autonomous: true
requirements: [R001, R002, R006]
key-files:
  created:
    - src/production/negotiation.ts
    - tests/unit/production/negotiation.test.ts
    - tests/unit/production/shell-relay-negotiation.test.ts
    - tests/browser/screenshots/production-relay-ready.png
    - tests/browser/screenshots/production-relay-upgrade.png
    - .gsd/milestones/M001/S11-PLAN.md
  modified:
    - src/production/contracts.ts
    - src/production/shell.ts
    - src/production/view.ts
    - src/production/main.ts
    - tests/browser/production-shell.spec.js
---

# S11 Summary: Capability And Minimum-Client Fail-Closed Negotiation

## Outcome

The S04 pinned Relay compatibility tracer and the S03 device capability gate are now
merged into one boot-time negotiation. `negotiation.ts` is a pure `negotiate(device,
relay?)` that combines a device `GateDecision` with a relay `CompatibilityReport`
into an overall outcome (`supported`/`limited`/`upgrade-required`/`unsupported`) with
`reasons`, a `recoverable` flag, the deciding `source`, and whether a relay report
participated.

The shell boot now runs device capabilities first; when a relay source is present it
shows a `CHECKING RELAY` transition, runs the source, negotiates, and renders the
result. An incompatible relay lands on a fail-closed `recover` screen (`UPGRADE
REQUIRED` or `UNSUPPORTED`) with a focusable `RETRY` that re-runs negotiation. A fully
compatible negotiation advances the ready screen from `READY FOR RELAY` /
`RELAY NOT CONFIGURED` to `RELAY COMPATIBLE` / `S05 REQUIRED` — still exposing no Paseo
product data.

`main.ts` wires a loopback-only fixture source keyed by `?relay=<script>` that replays
an S04 pinned endpoint through the scripted transport, so the whole negotiation is
exercised end to end in the browser without a real network or owned hardware.

## Fail-Closed Rules

1. Device-hardware `unsupported` is terminal, **not** recoverable, and never contacts
   the relay (asserted: the relay source is not called and no `CHECKING RELAY` renders).
2. Device-only mode (no relay source) mirrors the S03 device decision.
3. Relay `upgrade-required` -> recoverable `UPGRADE REQUIRED`.
4. Relay `unsupported` -> recoverable `UNSUPPORTED`.
5. Relay `supported` + device `limited` -> read-only `LIMITED`.
6. Relay `supported` + device `supported` -> `RELAY COMPATIBLE`.

## Verification Evidence

- `npm run typecheck`: passed with strict options.
- `npm run test:production`: 51 tests passed, including 7 negotiation cases and 6
  shell-integration cases that drive the real `traceRelayCompatibility` through the
  scripted transport (supported, upgrade-required, malformed-frame unsupported, retry
  recovery, device-unsupported-skips-relay, and payload-free diagnostics).
- `npm run verify`: probe 18, production 51, S01 budgets, source boundary
  (15 bundle inputs, all under `src/production`), output 23,571 / 131,072 bytes with
  0 remote dependencies, and 12 browser scenarios — all passed end to end.
- New fixed screenshots `production-relay-ready.png` and `production-relay-upgrade.png`
  generated at 240x282 and visually inspected: no clipping, overlap, or overflow.
- Diagnostics remain payload-free (asserted against the S04 sentinels).

## Deliberate Limits

- Negotiation is driven by S04 pinned fixtures over the scripted transport. There is
  no real WSS/E2EE transport and no imported real Relay offer — establishing those on
  the owned R1 and displaying a live Workspace/Attention/Agent timeline is S05 and
  requires S02 hardware evidence, which this slice does not substitute.
- Reaching `RELAY COMPATIBLE` still exposes no product data, enrollment, Device grant,
  snapshot, or Controlled Action. `S05 REQUIRED` is the intentional next gate.
- The fixture relay source is restricted to loopback origins (same gate as
  `?fixture=supported`); a deployed URL cannot trigger it.
- The pinned versions and topic set remain current assumptions to reconcile against the
  real daemon in S05; drift fails visibly today.

## Deviations

- The relay module now ships in the default bundle (23,571 bytes, up from 15,706),
  because negotiation is wired into boot. This is within the 131,072-byte budget and is
  recorded here.
- Test fixture data (`relay/fixtures.ts`) is bundled so the loopback `?relay=` demo can
  run; it is gated to loopback and carries only non-secret sentinel strings.
- The `limited` view model's `reasons` were widened from `GateReason[]` to `string[]`
  so relay-origin reasons and device reasons share one recovery/limited surface. No
  product-scope or roadmap-direction change was made.

## Self-Check: PASSED

All S11 tasks and acceptance criteria have current automated evidence. S05 real Relay
transport and S02 hardware evidence remain explicitly separate and unmet.
