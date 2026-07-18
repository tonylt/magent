# Rabbit R1 Paseo Companion Execution State

Last updated: 2026-07-18

## Current Position

- Milestone: M001 - Rabbit R1 Paseo Companion Daily-Use Release
- Active slices: S02 - Firmware-bound owned-R1 capability matrix (awaiting hardware); S05 - Real-R1 private Relay E2EE bootstrap (blocked on S02)
- Status: S01/S03/S04 complete; S02 awaiting owned-R1 hardware; S05 blocked on S02
- Completed slices: 3 / 21
- Roadmap: `.gsd/milestones/M001/M001-ROADMAP.md`

## Recent Progress

- `66e0e47` established the approved product, architecture, UI/UX, ADR, prototype, design-review evidence, and M001 roadmap baseline.
- `f31ee84` defined the S01 deterministic unit and browser contracts.
- `af2c4d6` wired the static probe through semantic input, Rabbit bridge, pure store, sanitized diagnostics, budgets, and fixed screenshots.
- `4751e03` created the separate TypeScript production Creation shell, DOM view, loopback browser fixture, Rabbit adapter selection, and reproducible esbuild artifact.
- `7f7388b` enforced source boundaries, static output allowlists, local-only dependencies, byte/DOM budgets, and fixed production screenshots.
- `46974df` made canceled native voice drain terminal-bound and routed touch detail commands through the shared adapter path.
- `0e543e0` recorded S03 production shell completion.
- S04 pinned the Relay `hello`/`offer`/`subscribe`/`frame` subset into a pure contract, a transport boundary, a compatibility tracer, and fixtures that fail visibly on any drift, without opening a real network or shipping in the default bundle.

## Execution Rules

- Commit each completed slice separately and record its verification evidence in the matching `Sxx-SUMMARY.md`.
- Do not mark a HITL slice complete from browser mocks or fixtures.
- Keep the roadmap direction stable; small implementation adjustments must be documented in the relevant summary.
- Do not expose the daemon through public temporary tunnels without explicit user approval.
- When running `npm run verify`, free TCP port 4173 first (`lsof -ti tcp:4173 | xargs kill -9`) so the two back-to-back Playwright web servers do not collide; this is an environment concern, not a code failure.

## Next Gate

S02 requires owned-R1 evidence and cannot be completed automatically. S05 depends on S02 and S04; with S04 now complete, S05 is blocked only on owned-R1 hardware. The next autonomous work is S11 (capability and minimum-client fail-closed negotiation, `depends:[S04]`) or S12 (immutable audited Creation release path, `depends:[S03]`), both of which can proceed against fixtures without hardware.
