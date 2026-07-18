---
milestone: M001
slice: S01
title: Automated Creation probe baseline
status: complete
completed: 2026-07-18
requirements: [R001, R012]
commits: [f31ee84, af2c4d6, 63ff62a, 80d6ec0]
key-files:
  created:
    - demo/lib/input-controller.js
    - demo/lib/rabbit-bridge-adapter.js
    - demo/lib/probe-store.js
    - demo/lib/diagnostics.js
    - demo/budgets.json
    - scripts/verify-budgets.mjs
    - tests/browser/probe.spec.js
  modified:
    - demo/app.js
    - demo/styles.css
    - demo/README.md
    - package.json
---

# S01 Summary: Automated Creation Probe Baseline

## Outcome

The build-free `demo/` now runs through one semantic input controller, one Rabbit/browser bridge adapter, an immutable probe reducer, and a bounded diagnostic allowlist. Native events, keyboard fallback, and touch share the same foreground gate; views no longer listen to RabbitOS globals directly.

Hold gestures consume clicks through release, including delayed release after the 30-second recording cap. Duplicate edges, too-short capture, one trailing click, lifecycle interruption, background input rejection, resume, native STT single-flight, synchronous bridge failures, and handler cleanup are deterministic and tested.

The exact 240x282 browser canvas, screenshots, static bytes, DOM nodes, input-to-DOM latency, diagnostic entries, and serialized diagnostic bytes are executable budgets. `demo/budgets.json` is the runtime and verification source for the diagnostic/DOM limits.

## Verification Evidence

- `npm test`: 18 unit tests passed.
- `npm run verify:budgets`: 8 served assets, 34,494 raw bytes total, 29,202 JavaScript bytes, 4,523 CSS bytes; runtime DOM/log budget test passed.
- `npm run test:browser`: 6 Chromium scenarios passed at 240x282.
- Stress case: 1,000 wheel events plus 100 enter/back cycles remained within 120 steady DOM nodes, 64 diagnostic entries, 16 KiB serialized diagnostics, and browser input-to-DOM p95 below 100ms.
- Fixed screenshots: Home, Capabilities, Recording, and Composer were generated and visually inspected without overflow, overlap, or clipping.
- Browser assertions reject remote runtime requests, console errors, page errors, transcript exposure through debug diagnostics, and late-click acceptance.
- `git diff --check`: passed before each implementation commit.

## Review Findings Resolved

- Moved the orange identity rule from a shrinking border to an inset visual treatment so `#app.clientHeight` is exactly 282px.
- Kept capped holds consumed until physical release and restarted one-click suppression at that release.
- Rejected Rabbit, keyboard, and touch input while backgrounded; `pageshow` restores the unified input path.
- Preserved touch focus details through the adapter so touch, wheel, and keyboard share the same reducer contract.
- Removed the full store from the debug surface; only a copy of the sanitized ring is exposed with `?debug=1`.
- Bound the live diagnostic ring and Playwright assertions to `demo/budgets.json` rather than duplicated constants.

## Deliberate Limits

- The 500ms late-click window is an S01 fixture, not a firmware claim. S02 must measure it on the supported R1 firmware.
- Browser p95, viewport, WSS presence checks, and mock STT do not prove RabbitOS wheel timing, native STT, secure-storage behavior, system device lock, WSS/E2EE, suspend/resume, battery, or real memory limits.
- S01 does not authorize Paseo data or Controlled Actions and does not complete any S02 HITL gate.

## Deviations

- Added a small top-level fetch of the local budget manifest so runtime diagnostics and automated verification have one source of truth. The manifest is counted as a served static asset and makes no remote request.
- No product-scope or roadmap-direction changes were made.

## Self-Check: PASSED

All S01 acceptance criteria are backed by current tests and artifacts. Remaining hardware claims are explicitly deferred to S02.
