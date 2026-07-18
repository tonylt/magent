---
milestone: M001
slice: S01
title: Automated Creation probe baseline
type: tdd
wave: 1
depends_on: []
status: complete
autonomous: true
requirements: [R001, R012]
files_modified:
  - package.json
  - package-lock.json
  - demo/app.js
  - demo/lib/input-controller.js
  - demo/lib/rabbit-bridge-adapter.js
  - demo/lib/probe-store.js
  - demo/lib/diagnostics.js
  - demo/budgets.json
  - tests/unit
  - tests/browser
  - scripts/verify-budgets.mjs
---

# S01: Automated Creation Probe Baseline

## Objective

Turn the existing build-free Creation probe into an executable contract: the browser and RabbitOS bridge use the same semantic input path, gesture races are deterministic, state and diagnostics are bounded, and fixed 240x282 states can be reproduced automatically.

## Tasks

1. Add a dependency-light Node and Playwright verification harness while keeping `demo/` directly serveable as static files.
2. Extract a pure semantic input controller and Rabbit bridge adapter; cover wheel, click, hold/release, duplicate events, one late-click suppression, recording cap, and lifecycle interruption.
3. Extract the probe store and bounded sanitized diagnostic ring; prevent prompt, transcript, token, credential, URL-query, and arbitrary payload data from entering logs.
4. Wire the existing UI through the extracted contracts without expanding the product scope.
5. Add bundle, DOM, log, viewport, overflow, and fixed-state screenshot checks.

## Verification

- `npm test`
- `npm run test:browser`
- `npm run verify:budgets`
- `git diff --check`

## Acceptance Criteria

- Native RabbitOS events and desktop fallback keys reach views only as semantic commands.
- A consumed hold cannot produce Select; repeated start/end and late click are deterministic; suspend/hidden state safely interrupts capture.
- The diagnostic log is a bounded allowlist and stores no free-form application or user payload.
- Browser checks prove a 240x282 viewport with no document overflow and stable screenshots for the selected S01 states.
- Budget verification fails when declared file, DOM, or log limits are exceeded.
