# M001: Rabbit R1 Paseo Companion Daily-Use Release

**Vision:** Deliver a single-user Rabbit R1 companion that safely reads and intervenes in one Paseo Host through Relay E2EE, with real-device evidence, independently revocable Device authorization, recoverable Follow-up commands, exact-turn Stop, and a measured seven-day daily-use release gate.

## Success Criteria

- On a supported Rabbit R1 firmware, the user can use wheel and side button to identify the highest-priority live Attention, inspect an Agent or Subagent, and return without precise touch.
- Cached data is visibly `STALE` until directory and per-Agent reconciliation finish; stale data never clears Attention or enables Controlled Actions.
- Permission remains a read-only handoff to full Paseo; the R1 never approves or denies a permission request.
- Device enrollment produces a Host-bound, independently revocable grant whose `read`, `follow-up`, and `stop` scopes are approved separately and never elevated by upgrade.
- Follow-up survives disconnects and process restarts without wrong-target or duplicate submission, and an uncertain outcome remains `UNKNOWN` rather than being blindly retried.
- Stop is bound to the exact confirmed turn and atomically rejects a successor-turn race.
- No secure Creation storage means distributable read-only operation only; Follow-up and Stop are absent.
- The daily-use release passes at least 20 eligible intervention sessions and 10 Controlled commands over seven days, with at least 80% R1-only success, identify p50 <= 3 seconds, safe Follow-up p50 <= 20 seconds, and zero wrong target, duplicate, misapproval, or mis-stop events.
- Wheel feedback is under 100 ms, normal-Wi-Fi first interaction is within 3 seconds, and a 30-minute session keeps DOM, timeline, timers, memory, and diagnostic data bounded.

## Key Risks / Unknowns

- RabbitOS Creation capability drift — wheel/PTT timing, native STT, secure storage, device lock, WSS, suspend/resume, and resource behavior are not proven by the browser prototype.
- Relay compatibility and Creation resource limits — the existing Paseo client and E2EE framing may exceed the R1 browser, bundle, frame, DOM, or memory budget.
- Attention and freshness correctness — bounded pagination, reconnect, and independent timeline cursors can silently omit Attention or falsely label stale data as live.
- Distributable Device trust — the existing Relay offer is operator authority for private dogfood, not a scoped, revocable Device grant.
- Controlled-command ambiguity — current message IDs and agent-wide cancellation do not provide durable dedupe, result query, or exact-turn cancellation.
- Static-origin supply chain and local persistence — an immutable audited bundle and secure local storage are required before controlled commands can be distributed.
- Daily-use ergonomics — battery, wake, CJK layout, long transcript review, and no-precise-touch operation require owned-device observation.

## Proof Strategy

- RabbitOS capability drift -> retire in S02 by recording a firmware-bound `PASS/FALLBACK/BLOCKER` matrix from the owned R1, backed by S01 deterministic race tests.
- Relay compatibility and resource limits -> retire in S05 and S10 by exercising real Relay E2EE on R1 and measuring bundle, frame, memory, DOM, timer, and 30-minute behavior.
- Attention and freshness correctness -> retire in S06-S10 with continuation fixtures, forced disconnect/suspend/restart scenarios, and private read-only dogfood.
- Distributable Device trust -> retire in S13-S16 with one-time enrollment, Trusted Paseo approval, independent scopes, secure persistence, and online/offline revocation.
- Controlled-command ambiguity -> retire in S18-S20 with durable command identity, payload-free receipts, dedupe/result query, authoritative timeline correlation, and exact-turn conditional cancellation.
- Static-origin and persistence risk -> retire in S12 and S15 through reproducible immutable installation, CSP/digest checks, restart/corruption tests, and fail-closed capability gates.
- Daily-use ergonomics -> retire in S21 through the deterministic release matrix plus the seven-day owned-device trial.

## Verification Classes

- Contract verification: deterministic state/store tests; semantic input and late-click race tests; Relay hello/frame fixtures; attention-first pagination fixtures; snapshot/draft corruption tests; protocol/minimum-client mismatch tests; enrollment, grant, scope, session, revoke, command dedupe/result-query, and exact-turn Stop matrices; fixed 240x282 screenshots; bundle/DOM/CSP/digest and sanitized-log checks.
- Integration verification: pinned R1 adapter against a real Paseo daemon and Relay E2EE; Workspace/Attention/Agent projections; directory refetch plus per-Agent timeline reconciliation; Trusted Paseo Device approval/revoke; authoritative Follow-up and Stop correlation.
- Operational verification: immutable version install and cache-busted upgrade; offline/online, Wi-Fi switch, suspend/wake, daemon restart, process restart, grant expiry/revoke, command recovery, bounded retry, 30-minute resource run, and self-host packaging.
- UAT / human verification: owned-R1 firmware and device-lock evidence; wheel/PTT/native STT/OSK/CJK behavior; verification words and scope approvals; full transcript review; permission handoff; successor-turn rejection; seven-day daily-use dogfood.

## Milestone Definition of Done

This milestone is complete only when all are true:

- All 21 slice deliverables are complete and their declared proof level has been met.
- The R1 Creation, Paseo client adapter, protocol, daemon, Relay, Trusted Paseo Device UI, persistence, and release pipeline are wired together rather than demonstrated only through mocks.
- The immutable install URL and QR are exercised on the supported owned R1 firmware against a real Paseo Host.
- All success criteria are re-checked against live behavior and the deterministic security/fault matrices, not inferred from design artifacts or low-sample dogfood.
- The integrated wake -> sync -> Attention -> Agent -> Follow-up -> exact-turn Stop -> reconnect journey passes, while Permission remains handoff-only.
- Security and diagnostic review confirms no token, prompt, transcript, timeline payload, command payload, or sensitive third-party configuration is persisted in telemetry or release artifacts.
- Projection gateway and native Android remain unbuilt unless their documented measurement gates are triggered.

## Requirement Coverage

- R001: Real-device capability and supported-firmware evidence.
- R002: Relay-only E2EE production transport.
- R003: Bounded Home, Workspace, Agent, Subagent, timeline, and Attention reading.
- R004: Explicit stale/live freshness and authoritative reconnect reconciliation.
- R005: Read-only Permission handoff.
- R006: Immutable, audited, upgradeable Creation release.
- R007: One-time Device enrollment, Host-bound grants, short sessions, independent scopes, management, and revoke.
- R008: Secure local persistence and fail-closed Controlled-Action gates.
- R009: Target-bound dictation, Draft, complete review, Send, and Cancel.
- R010: Durable, deduplicated, queryable Follow-up with no blind retry.
- R011: Separately scoped exact-turn conditional Stop.
- R012: Deterministic release matrices and measured seven-day daily-use acceptance.
- Covers: R001 real-device capability proof; R002 Relay-only E2EE; R003 bounded read navigation and Attention; R004 freshness and reconciliation; R005 permission handoff; R006 immutable release; R007 Device enrollment/grant/session/revoke; R008 secure local persistence gates; R009 target-bound dictation and Draft; R010 durable Follow-up; R011 exact-turn Stop; R012 daily-use release metrics.
- Partially covers: none.
- Leaves for later: multi-Host, team/shared-device authorization, background notification SLA, Agent/Workspace creation, terminal/diff/file editing, full Voice mode, Direct/LAN production transport, and native Android unless S02/S10 measurements trigger Phase 4.
- Orphan risks: none; every current product-design risk is mapped to S01-S21 or explicitly gated out of scope.

## Slices

- [x] **S01: Automated Creation probe baseline (AFK)** `risk:high` `depends:[]`
  > After this: the browser runs the real semantic input controller and Rabbit bridge adapter against deterministic state tests, fixed 240x282 screenshots, resource budgets, and payload-free diagnostic logs.
- [ ] **S02: Firmware-bound owned-R1 capability matrix (HITL)** `risk:high` `depends:[S01]`
  > After this: one tested firmware has recorded `PASS/FALLBACK/BLOCKER` evidence for wheel, side-button/PTT races, STT, CJK/OSK, HTTPS/WSS, secure storage, device lock, suspend/resume, and resource limits before sensitive data is exposed.
- [x] **S03: Production Creation shell and platform adapters (AFK)** `risk:medium` `depends:[S01]`
  > After this: the same production shell runs through either the deterministic browser adapter or RabbitOS adapter, with stable semantic commands and no private device API leaking into views.
- [x] **S04: Pinned Relay E2EE compatibility tracer (AFK)** `risk:high` `depends:[S03]`
  > After this: a pinned Paseo client adapter exchanges the actual hello, offer, subscription, and frame subset against fixtures and fails visibly on a contract mismatch.
- [ ] **S05: Real-R1 private Relay E2EE bootstrap (HITL)** `risk:high` `depends:[S02,S04]`
  > After this: the owned R1 uses the existing private Relay offer to reach a real daemon over WSS/E2EE and display one Workspace, one Attention item, and one live Agent timeline, explicitly marked private and not distributable.
- [ ] **S06: Safety projection and Attention-first Home (AFK + HITL)** `risk:high` `depends:[S05]`
  > After this: the R1 renders a bounded, data-minimized Home whose stable focus survives updates and whose pagination never silently drops unresolved Attention, showing `MORE ATTENTION IN PASEO` when necessary.
- [ ] **S07: Workspace, Agent, and Subagent read path (AFK + HITL)** `risk:medium` `depends:[S06]`
  > After this: wheel and side button alone navigate Home -> Workspace -> root Agent -> parent-scoped Subagents -> bounded timeline -> Back while preserving ownership, source stack, and Native read-only status.
- [ ] **S08: Attention handling and Permission handoff (AFK + HITL)** `risk:high` `depends:[S06,S07]`
  > After this: finished/error Attention clears only after matching complete live content is committed, while Permission displays completeness and `CONTINUE IN PASEO` without any approve/deny path.
- [ ] **S09: Offline, suspend, and authoritative reconciliation (AFK + HITL)** `risk:high` `depends:[S06,S07]`
  > After this: disconnect or suspend leaves a readable `STALE` snapshot with actions disabled, and recovery becomes `LIVE` only after directory refetch/resubscribe and current-Agent timeline reconciliation finish without focus loss.
- [ ] **S10: Private read-only dogfood and gateway decision gate (HITL)** `risk:medium` `depends:[S08,S09]`
  > After this: multiple Workspaces, Agents, Subagents, Attention overflow, daemon restart, and 30-minute resource behavior pass private read-only dogfood, and a projection gateway is opened only if measured limits fail.
- [ ] **S11: Capability and minimum-client fail-closed negotiation (AFK)** `risk:high` `depends:[S04]`
  > After this: the existing hello path negotiates R1 capabilities and minimum client versions end to end, and unsupported combinations show a recoverable upgrade/unsupported screen before sensitive data or actions are enabled.
- [ ] **S12: Immutable audited Creation release path (AFK + HITL)** `risk:medium` `depends:[S03]`
  > After this: a versioned immutable URL with vendored QR, strict CSP, dependency pinning, audit digest, and cache-busted upgrade installs reproducibly on the owned R1.
- [ ] **S13: One-time Device enrollment and read grant (AFK + HITL)** `risk:high` `depends:[S02,S11,S12]`
  > After this: the R1 enters a one-time code, matches verification words, receives Trusted Paseo approval for a Host-bound read grant, exchanges it for a short Device session, and completes first sync with denial/replay/mismatch recovery paths.
- [ ] **S14: Trusted Paseo Device management and scope elevation (AFK + HITL)** `risk:high` `depends:[S13]`
  > After this: Trusted Paseo lists the Device and audit identity, can revoke it, and separately elevates `follow-up` and `stop` without upgrade-driven or implicit scope expansion.
- [ ] **S15: Secure persistence and local safety gates (AFK + HITL)** `risk:high` `depends:[S02,S13]`
  > After this: grant, bounded snapshot, target-bound Draft, and payload-free receipt survive permitted restart/corruption cases, while missing secure storage or reliable local lock reduces the product to read-only and removes Controlled Actions.
- [ ] **S16: Online/offline revocation and derived-session invalidation (AFK + HITL)** `risk:high` `depends:[S14,S15]`
  > After this: online or offline Device revocation invalidates every derived session, wipes local authorization state on contact, blocks old commands, and provides a clear re-enrollment path.
- [ ] **S17: Target-bound dictation, Draft, and full review (AFK + HITL)** `risk:high` `depends:[S07,S15]`
  > After this: hold/release dictation appends only to the Draft bound to the current Host/Workspace/Agent, supports complete paged read-through with Cancel as default, and never sends automatically or overwrites a foreign Draft.
- [ ] **S18: Recoverable command ledger and result query (AFK)** `risk:high` `depends:[S11,S16]`
  > After this: a narrow test command crosses R1, Relay, protocol, and daemon with stable commandId, atomic payload-free receipt, durable dedupe, authoritative result query, and deterministic `confirmed`/`failed`/`UNKNOWN` outcomes at every write boundary.
- [ ] **S19: Follow-up-only end-to-end beta (AFK + HITL)** `risk:high` `depends:[S17,S18]`
  > After this: a separately approved `follow-up` Device sends a reviewed Draft and clears it only after matching authoritative timeline confirmation, with restart, disconnect, duplicate, target-switch, revoke, and `UNKNOWN` cases producing zero duplicate or wrong-target sends and no Stop UI.
- [ ] **S20: Exact-turn Stop end-to-end (AFK + HITL)** `risk:high` `depends:[S19]`
  > After this: a separately approved `stop` Device freezes `targetTurnId`, invokes atomic conditional cancellation, correlates exact-turn results after reconnect, and reports `TURN CHANGED - NOTHING STOPPED` instead of cancelling a successor turn.
- [ ] **S21: Integrated daily-use release and seven-day gate (HITL)** `risk:high` `depends:[S08,S09,S12,S16,S19,S20]`
  > After this: the immutable owned-R1 build completes the real wake-to-intervention journey, passes security/fault/resource/upgrade diagnostics and self-host packaging, and meets the defined seven-day product and engineering release thresholds.

## Horizontal Checklist

- [ ] Product contract, domain language, client design, UI/UX design, design review, and ADRs re-read against each completed slice.
- [ ] Relay-only production transport and the private-only status of the existing Relay offer remain enforced.
- [ ] Permission remains read-only handoff; no R1 permission response endpoint or UI is introduced.
- [ ] Auth boundaries are documented across installation QR, Relay bootstrap, Device enrollment, Device grant, Device session, scope elevation, and revoke.
- [ ] Every server action rechecks Device identity, grant state, scope, target identity, compatibility, and command preconditions rather than trusting client UI state.
- [ ] Reconnection and retry behavior is verified for Relay, directories, each open Agent timeline, enrollment, grant/session refresh, command query, and revoke.
- [ ] Storage, pagination, timeline, DOM, frame, log, retry, timer, memory, battery, and rate-limit budgets remain bounded.
- [ ] Diagnostic and audit paths contain identity and result metadata only, never token, prompt, transcript, timeline, or command payload content.
- [ ] Graceful suspend, process termination, restart, cache corruption, Device reset, and local wipe behavior is verified.
- [ ] Native Android and projection gateway remain conditional decisions backed by S02/S10 measurements, not scheduled assumptions.
- [ ] Revenue / billing path impact assessed as N/A for this single-user companion milestone.

## Boundary Map

### S01 -> S02, S03

Produces:
- `RabbitBridgeAdapter` and semantic commands for wheel, click, hold, release, voice, lifecycle, and fallback input.
- Deterministic gesture race fixtures, fixed-viewport states, resource budgets, and sanitized diagnostic event schema.

Consumes:
- Existing `demo/`, `prototype/index.html`, `DESIGN.md`, and Rabbit R1 product/client contracts.

### S02 -> S05, S13, S15, S17

Produces:
- Firmware-bound capability report with evidence identifiers and `PASS/FALLBACK/BLOCKER` outcomes.
- Controlled-Action eligibility inputs for secure storage, reliable device lock, voice, WSS/E2EE, and lifecycle behavior.

Consumes:
- S01 adapters, race harness, diagnostic schema, and resource budgets.

### S03 -> S04, S12

Produces:
- Production Creation entrypoint, platform-adapter interface, semantic input controller, and view/store boundary.
- Reproducible client bundle and version metadata surface.

Consumes:
- S01 semantic commands, fixed viewport states, and diagnostic contract.

### S04 -> S05, S11

Produces:
- Pinned Paseo adapter and fixtures for WebSocket hello, Relay offer, E2EE frames, subscriptions, and visible compatibility failures.

Consumes:
- S03 production shell and adapter boundary.

### S05 -> S06

Produces:
- Real-R1 private E2EE connection path and measured frame/bundle/runtime observations.
- Minimal live Workspace, Attention, Agent timeline, and private-authority marker.

Consumes:
- S02 WSS/crypto/lifecycle evidence and S04 pinned transport contract.

### S06 -> S07, S08, S09

Produces:
- Safety-projected directory records, attention-first page/cursor/`totalAttention` contract, bounded Home store, and stable focus identity.
- Orthogonal transport, freshness, auth, compatibility, lifecycle, attention, and aggregate status dimensions.

Consumes:
- S05 live Relay connection and canonical Paseo identities.

### S07 -> S08, S09, S17

Produces:
- Workspace/root-Agent/managed-Subagent/Native-subagent navigation contracts, source stack, and bounded projected timeline views.

Consumes:
- S06 projected directory entities, orthogonal state, focus identity, and continuation behavior.

### S08, S09 -> S10, S21

Produces:
- Stable attention version, complete-content clear preconditions, idempotent clear, and read-only Permission projection.
- Snapshot freshness state machine, directory refetch/resubscribe, per-Agent epoch/sequence reconciliation, and bounded retry policy.

Consumes:
- S06 Home and S07 navigation/timeline contracts.

### S03 -> S12 -> S13

Produces:
- Immutable `/r1/vX/` release URL, install QR, CSP, dependency manifest, digest, and upgrade contract.

Consumes:
- S03 reproducible production bundle and version metadata.

### S04 -> S11 -> S13, S18

Produces:
- Extended hello capabilities, protocol/minimum-client gates, compatibility result, and fail-closed client recovery states.

Consumes:
- S04 pinned wire fixtures and current Paseo protocol negotiation.

### S02, S11, S12 -> S13 -> S14, S15

Produces:
- One-time enrollment records, verification words, Host-bound Device identity, `read` grant, short-lived Device session, and audit identifiers.

Consumes:
- S02 local capability decision, S11 compatibility decision, and S12 immutable client identity/version.

### S13 -> S14 -> S16

Produces:
- Trusted Paseo Device list/detail/revoke surfaces and explicit `read`/`follow-up`/`stop` scope transitions.

Consumes:
- S13 Device identity, grant/session records, and audit identifiers.

### S02, S13 -> S15 -> S16, S17

Produces:
- Versioned encrypted local grant/snapshot/Draft/receipt records, TTL/cap/corruption handling, and read-only downgrade invariant.

Consumes:
- S02 secure-storage/device-lock evidence and S13 Device authorization records.

### S14, S15 -> S16 -> S18

Produces:
- Independent Device revoke record, derived-session invalidation, scope recheck invariant, local wipe signal, and re-enrollment recovery state.

Consumes:
- S14 management/scopes and S15 persisted authorization state.

### S07, S15 -> S17 -> S19

Produces:
- `TargetBoundDraft`, `preDictationDraft`, read-through revision state, transcript append/cancel rules, and target-availability gate.

Consumes:
- S07 canonical target/navigation identity and S15 secure Draft persistence.

### S11, S16 -> S18 -> S19, S20

Produces:
- Stable commandId, durable daemon dedupe record, atomic payload-free client receipt, result-query protocol, and authoritative correlation states.

Consumes:
- S11 compatible protocol surface and S16 live Device/session/scope enforcement.

### S17, S18 -> S19 -> S20, S21

Produces:
- Follow-up submission contract, authoritative timeline command correlation, recovery matrix, and Follow-up-only beta gate.

Consumes:
- S17 reviewed target-bound Draft and S18 recoverable command lifecycle.

### S19 -> S20 -> S21

Produces:
- Stable `targetTurnId`, atomic conditional cancel request, exact-turn result correlation, successor-turn rejection, and separately scoped Stop UI.

Consumes:
- S19 proven command reconciliation and Device scope workflow.

### S08, S09, S12, S16, S19, S20 -> S21

Produces:
- Integrated immutable release artifact, self-host package, bounded diagnostics, deterministic release evidence, and seven-day dogfood report.

Consumes:
- Complete Attention/Permission, reconciliation, release, authorization/revoke, Follow-up, and exact-turn Stop behavior.
