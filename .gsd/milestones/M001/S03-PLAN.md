---
milestone: M001
slice: S03
title: Production Creation shell and platform adapters
type: tdd
wave: 2
depends_on: [S01]
status: planned
autonomous: true
requirements: [R001, R004, R006, R012]
files_modified:
  - src
  - scripts/build-production.mjs
  - tests/unit/platform
  - tests/browser/production-shell.spec.js
  - package.json
  - tsconfig.json
---

# S03: Production Creation Shell and Platform Adapters

## Objective

Create the real TypeScript Creation entrypoint and lightweight build pipeline. One shell consumes a stable `PlatformAdapter` contract and runs with either deterministic browser fixtures or RabbitOS globals. Views and stores receive semantic commands and capability snapshots only; they never access private `window.Creation*` APIs.

## Proposed Boundaries

- `src/contracts`: semantic input, lifecycle, voice, capability, and shell-state types with no DOM globals.
- `src/platform/browser`: deterministic keyboard/touch/fixture adapter for tests and development.
- `src/platform/rabbit`: the only production module allowed to read RabbitOS bridge globals.
- `src/shell`: lifecycle orchestration, capability-before-data gate, immutable reducer, and adapter disposal.
- `src/views`: plain DOM rendering against typed view models only.
- `scripts/build-production.mjs`: pinned esbuild bundle plus local HTML/CSS copy; no framework or remote runtime dependency.

## Tasks

1. Write RED contract tests proving browser and Rabbit adapters emit the same semantic commands, lifecycle and voice results, including details and cleanup.
2. Define typed adapter/shell/view contracts and port the verified S01 gesture invariants without importing demo UI state into production.
3. Build a deterministic browser adapter and Rabbit adapter; keep feature detection and raw globals inside platform modules.
4. Implement the minimal production shell with capability-first boot, `LIMITED/UNSUPPORTED` safe states, bounded diagnostics, and no Paseo data or Controlled Actions.
5. Add a reproducible static build and browser tests at 240x282 for both adapter selections.
6. Verify source scans prevent `CreationVoiceHandler`, `creationStorage`, native event names, or raw plugin payloads from appearing in views/store modules.

## Verification

- `npm run typecheck`
- `npm test`
- `npm run build`
- Production browser shell tests at 240x282
- Built-output remote dependency and byte-budget checks
- Source-boundary scan for RabbitOS globals
- `git diff --check`

## Acceptance Criteria

- The same shell state and screen result from equivalent browser and Rabbit adapter fixtures.
- All view actions flow through semantic commands; background input is rejected consistently.
- Capability gating runs before any transport, grant, snapshot, or product-data API exists.
- Production views and stores contain no RabbitOS private global names or raw bridge payload handling.
- The generated static shell loads locally without a framework, remote font, CDN, or runtime build step.
- S01 remains a hardware probe; the production shell is a separate entrypoint and build artifact.
