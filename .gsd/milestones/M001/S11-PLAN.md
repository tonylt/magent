---
milestone: M001
slice: S11
title: Capability and minimum-client fail-closed negotiation
type: tdd
wave: 3
depends_on: [S04]
status: in_progress
autonomous: true
requirements: [R001, R002, R006]
files_modified:
  - src/production/negotiation.ts
  - src/production/contracts.ts
  - src/production/shell.ts
  - src/production/view.ts
  - src/production/main.ts
  - tests/unit/production
  - tests/browser/production-shell.spec.js
  - .gsd/milestones/M001/S11-PLAN.md
  - .gsd/milestones/M001/S11-SUMMARY.md
---

# S11: Capability And Minimum-Client Fail-Closed Negotiation

## Objective

Wire the S04 pinned Relay compatibility tracer and the S03 device capability gate
into one boot-time negotiation. After the device gate passes, the shell negotiates
relay protocol and minimum-client compatibility end to end (driven by S04 pinned
fixtures, no real network) and, on any incompatible combination, shows a
**recoverable** upgrade/unsupported screen *before* any sensitive data or action is
enabled. A supported negotiation advances the ready state from "relay not
configured" to "relay compatible", still without Paseo product data.

## Consumes / Produces

- Consumes: S04 `traceRelayCompatibility`, pinned fixtures, and scripted transport;
  S03 `evaluateCapabilities` device gate and capability-first shell boot.
- Produces: a pure `negotiate` merge of device + relay outcomes, extended shell
  boot with an optional relay source, a `checking-relay` transition, and a
  fail-closed `recover` screen with retry. Feeds S13 (enrollment gating) and S18
  (command protocol) with a compatible-protocol precondition.

## Negotiation Rules (fail-closed)

Inputs: device `GateDecision` (`supported`/`limited`/`unsupported`) and an optional
relay `CompatibilityReport` (`supported`/`limited`/`upgrade-required`/`unsupported`).

1. Device `unsupported` -> overall `unsupported`, device reasons, **not** recoverable
   (hardware cannot be fixed by retry). Relay is never contacted.
2. No relay report (device-only mode) -> mirror the device decision; `supported`
   renders the S03 "relay not configured" ready state.
3. Relay `upgrade-required` -> overall `upgrade-required`, relay failure label,
   **recoverable** (upgrade client/relay then retry).
4. Relay `unsupported` -> overall `unsupported`, relay failure label, **recoverable**
   (contract/transport drift may be transient; retry after fix).
5. Relay `supported` + device `limited` -> overall `limited` (read-only), device reasons.
6. Relay `supported` + device `supported` -> overall `supported` (relay compatible).

## Tasks

1. RED unit tests + `negotiation.ts` pure merge covering every device x relay pair,
   including recoverable flags and reason provenance.
2. Extend `contracts.ts`: widen the `ready` items, add `checking-relay` and `recover`
   view models, add a `RelayCompatibilitySource`, and extend diagnostics.
3. Integrate into `shell.ts`: after a passing device gate, if a relay source exists,
   render `checking-relay`, run the source, negotiate, and render the result;
   support retry from a recoverable `recover` screen; keep fail-closed on source error.
4. Render new screens in `view.ts`, including a focusable `RETRY` affordance.
5. Provide a fixture relay source in `main.ts` keyed by `?relay=` using the S04
   scripted transport, so browser tests can drive supported / upgrade-required /
   unsupported / retry end to end. Default (no fixture) still fails closed.
6. Add browser tests and 240x282 screenshots for relay-compatible ready and the
   recover screen.

## Verification

- `npm run typecheck`, `npm run test:production`
- `npm run verify` (unit, budgets, source/output boundary, browser)
- New fixed screenshots inspected for no clipping/overlap at 240x282.

## Acceptance Criteria

- Device-hardware `unsupported` never contacts the relay and is not recoverable.
- Relay `upgrade-required`/`unsupported` render a recoverable screen with retry, and
  retry re-runs negotiation deterministically.
- A supported negotiation shows "relay compatible" and still exposes no product data,
  enrollment, grant, or Controlled Action (those remain S05/S13+).
- Diagnostics stay payload-free (identity/result metadata only).
- Default production bundle stays within byte/DOM budgets; the relay module now ships
  because it is wired into boot, and the increase is recorded.
- No real network and no owned-R1 substitution: S05 hardware evidence stays separate.
