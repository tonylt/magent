---
milestone: M001
slice: S03
title: Production Creation shell and platform adapters
status: complete
completed: 2026-07-18
requirements: [R001, R004, R006, R012]
key-commits: [68e64d6, 8765652, 26787ec, 4751e03, 7f7388b, 0b84752, b6e278d, 46974df]
key-files:
  created:
    - src/production/main.ts
    - src/production/shell.ts
    - src/production/contracts.ts
    - src/production/platform/browser.ts
    - src/production/platform/rabbit.ts
    - src/production/diagnostics.ts
    - scripts/build-production.mjs
    - scripts/verify-production-source.mjs
    - scripts/verify-production-output.mjs
    - tests/browser/production-shell.spec.js
---

# S03 Summary: Production Creation Shell and Platform Adapters

## Outcome

The production client is now a separate TypeScript entrypoint under `src/production`, bundled to `dist/production` without importing `demo/` or `prototype/`. One capability-first shell consumes either a browser or Rabbit platform adapter; production views receive typed view models and semantic commands only. Rabbit private globals and raw native payloads are confined to `src/production/platform/rabbit.ts`.

The default shell fails closed with `NO DATA`. The deterministic supported fixture is restricted to loopback origins and does not choose the adapter. Critical unknown/missing capabilities remain unsupported, noncritical gaps become limited, capability probe failures render a sanitized unsupported state, and product data remains disabled throughout S03.

Input, lifecycle, touch details, voice results, cleanup, and disposal use shared adapter contracts. Background commands are rejected at both runtime and shell boundaries; `pagehide/pageshow` restores input. Voice requests require explicit IDs, canceled requests cannot release their drain until the native terminal arrives, normal terminal duplicates receive a bounded quarantine, and disposing an active adapter stops native capture.

## Verification Evidence

- `npm run typecheck`: passed with strict TypeScript options.
- `npm test`: 18 S01 probe tests and 17 production tests passed.
- `npm run verify:production-source`: 10 bundle inputs verified under `src/production`; Rabbit private identifiers occur only in the Rabbit adapter; no external or dynamic imports.
- `npm run verify:production-output`: 15,706 / 131,072 static bytes, local output whitelist and hashes valid, no sourcemap, no remote dependency, and deterministic build metadata.
- `npm run test:production-browser`: 4 Chromium scenarios passed at exact 240x282 for browser/Rabbit parity, fail-closed default, background touch rejection, lifecycle restoration, console/page/request monitoring, and the DOM budget.
- Fixed screenshots: `production-ready.png` and `production-unsupported.png` were generated and visually inspected without clipping, overlap, or overflow.
- Full `npm run verify`: 35 unit tests and 10 browser scenarios passed across S01 and S03.
- Fresh code review: no remaining P0/P1. Final acceptance review passed Tasks 1-6, Acceptance 6/6, and Verification 7/7.

## Review Findings Resolved

- Restricted `?fixture=supported` to loopback origins so deployed URLs cannot bypass capability gating.
- Preserved bfcache/suspend recovery by keeping the shell alive across `pagehide/pageshow`.
- Bound hold release to its input source, including the post-cap release latch.
- Stopped active native capture on disposal and made disposed voice APIs terminal.
- Prevented canceled native results from binding to a successor request; isolated prior plugin observers and duplicate terminals.
- Added bounded, allowlisted, payload-free production diagnostics with validated budgets.
- Routed touch `focus-at.index` through the same adapter/runtime gate as Rabbit and keyboard commands.
- Added fail-closed capability error handling and rollback of the previous artifact if atomic publication fails.

## Deliberate Limits

- S03 exposes no Relay transport, Paseo product data, enrollment, grant, snapshot, or Controlled Action. `RELAY NOT CONFIGURED · S04 REQUIRED` is intentional.
- Browser and injected Rabbit fixtures prove contract parity, not owned-R1 firmware behavior. S02 remains `awaiting_hardware` and browser evidence cannot satisfy it.
- The normal-terminal 500ms duplicate quarantine is a conservative fixture/default, not a measured firmware fact. Cancellation drain does not time out; S02 must characterize actual native terminal behavior.
- The build is local and reproducible, but immutable hosting, install QR, strict release audit, and cache-busted upgrade belong to S12.

## Deviations

- The proposed top-level `src/contracts`, `src/platform`, `src/shell`, and `src/views` directories were kept under `src/production` to make the production source boundary mechanically scannable and prevent accidental demo imports.
- A deterministic browser voice fixture was added because READY capability claims must match adapter behavior and voice-result parity needed executable evidence.
- No product-scope or roadmap-direction changes were made.

## Self-Check: PASSED

All S03 tasks and acceptance criteria have current automated evidence. S02 hardware claims and S04 Relay compatibility remain explicitly separate.
