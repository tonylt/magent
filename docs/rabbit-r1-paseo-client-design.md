# Rabbit R1 Paseo Client: Solution Design

[简体中文](rabbit-r1-paseo-client-design.zh-CN.md) | English

Status: Proposed  
Date: 2026-07-17  
Audience: Engineers implementing or reviewing the first Rabbit R1 client for Paseo

## 1. Purpose

This document defines an implementable first version of a Paseo client for Rabbit R1. After reading it, an engineer should be able to split the MVP into work items, implement the device client and its server-facing adapter, and verify the result on real hardware.

The client turns Rabbit R1 into a compact remote control for coding agents that run through Paseo on another machine. It is optimized for checking work, sending short follow-ups, and handling decisions while away from a desktop. It is not intended to reproduce the complete Paseo mobile or desktop interface.

The first release serves one core scenario: Paseo already has Agent sessions running on one personal Host; after being away from the desk for 5–30 minutes, the user actively opens R1, identifies and handles one attention item within 5–30 seconds, then puts the device away. R1 is an away-from-desk intervention surface, not a second Paseo management interface.

## 2. Goals And Non-Goals

### 2.1 Goals

- Install and update the client without unlocking or reflashing Rabbit R1.
- Connect securely to an existing Paseo installation through the end-to-end encrypted Paseo Relay.
- Show attention items with their host, project, workspace, and agent-session context in a form readable on the R1 display.
- Open an agent within its workspace context and follow its most relevant recent activity.
- Complete a Follow-up through push-to-talk, complete review, and explicit Send.
- Stop a running Agent session and safely hand Permission requests off to a full Paseo client.
- Work primarily through the scroll wheel and side button, with touch as a secondary input.
- Recover coherently from suspension, network loss, daemon restart, and stale credentials.
- Synchronize quickly after an active launch; cached data may render immediately, but `LIVE` appears only after replay/snapshot reconciliation completes.

### 2.2 Non-Goals For The MVP

- Running coding agents or the Paseo daemon on Rabbit R1.
- Reproducing the full timeline, terminal emulator, file explorer, diff viewer, or workspace manager.
- Reusing the existing phone layout unchanged.
- Replacing the RabbitOS launcher or voice assistant.
- Requiring bootloader unlock, root, Magisk, AOSP, or CipherOS.
- Supporting arbitrary third-party Paseo extensions on the device.
- Editing source code on the R1.
- Creating Agent sessions, Workspaces, or Schedules, or changing provider, model, or mode.
- Archiving an Agent/Workspace, closing or reopening an Agent session, detaching a Subagent, or deleting/terminating a Native subagent.
- Promising background notifications, real-time wakeup, or a push SLA while the Creation is suspended.
- Promising typed Follow-up as a core capability before real-device validation of OSK height, focus, and target-language input.

## 3. Device And Platform Constraints

The MVP runs as a RabbitOS Creation, a hosted WebView application installed from a QR payload.

The following constraints are treated as product requirements:

- The effective Creation viewport is 240 by 292 CSS pixels. The physical display resolution is not the application layout size.
- The scroll wheel dispatches discrete up and down events. It should move selection, not imitate high-resolution inertial scrolling.
- The side button provides short-click and press-and-hold events. Push-to-talk is the primary composition path.
- Native speech-to-text returns a completed transcript through the Creation bridge. The client does not own raw microphone streaming in the MVP.
- Touch is available, but targets must remain usable without precise touch input.
- The WebView has limited rendering capacity. Large DOM trees, rich Markdown, WebGL, continuous animations, and unbounded logs are inappropriate.
- The client is loaded from HTTPS. Remote connections must use secure WebSocket or HTTPS endpoints.
- Creations are cached by installation URL. Releases need versioned URLs or equivalent cache busting.
- Device bridge features vary by RabbitOS version. Every native API must be feature-detected, with a visible fallback or an explicit unsupported state.
- First-release chrome uses short English labels with no language switcher. Project, Workspace, Agent title, timeline summary, and transcript preserve original UTF-8/CJK content.

Community experiments show that a Creation can use the scroll wheel, side button, native speech-to-text, secure storage, sensors, HTTPS, Server-Sent Events, and WebSocket connections. These capabilities are sufficient for the proposed client.

The first distributable release supports exactly one Tested firmware that has passed the complete matrix on the owned R1. Startup still feature-detects every capability, but apparent operation on another build is not a compatibility promise. An unknown build or missing non-security capability may enter explicitly labeled read-only `LIMITED`; missing E2EE, identity, or data-integrity capability shows `UNSUPPORTED`, receives no sensitive data, and never enables Controlled Actions. Expanding firmware support requires the full hardware matrix again.

## 4. Solution Choice

### 4.1 Selected Approach

Build a dedicated Rabbit R1 Creation and first reuse the existing Paseo Relay, E2EE, and WebSocket contract. A pinned local client adapter isolates unstable SDK APIs, while contract tests fix the exact message subset used by R1.

```text
Rabbit R1
Creation WebView
  - agent list
  - activity summary
  - PTT and text input
  - stop and permission handoff
  - pinned Paseo client adapter
        |
        | Paseo WebSocket + E2EE
        v
Paseo Relay (E2EE)
        |
        v
Paseo daemon
        |
        v
Claude Code, Codex, Copilot, OpenCode, Pi
```

Device grants are a separate unconditional authorization extension, not a reason to pre-commit to a full projection gateway. Add a narrow versioned projection gateway only when real-device measurements prove that bundle or memory cost, Relay frame/timeline size, protocol compatibility, or server-enforced projection cannot meet release gates.

### 4.2 Why Not Use The Existing Paseo App Directly

The existing Expo client is designed for phone, tablet, web, and desktop layouts. Even its compact layout assumes substantially more space and input precision than a Creation provides. Loading the complete application would also bring unnecessary navigation, retained panels, terminal rendering, file browsing, and state subscriptions onto limited hardware.

The R1 client should share domain contracts and semantics with Paseo, but own its presentation and local state.

### 4.3 Why Not Flash Android First

Community firmware work can run AOSP or CipherOS on the device, but current reports include touchscreen suspend failures, inconsistent side-button support, MediaTek fastboot complications, and recovery procedures that require Linux tooling. None of these risks are necessary to prove the Paseo use case.

Native Android becomes justified only when the Creation sandbox blocks a validated product requirement, such as reliable background connectivity, lower-level audio control, system notifications, or hardware behavior unavailable through the bridge.

## 5. User Experience

### 5.1 Navigation Model

The interface has six primary view groups:

1. **Home**: attention items followed by workspaces grouped under projects.
2. **Workspace**: root Agent sessions in one workspace.
3. **Agent**: a projected timeline that preserves host, project, and workspace context.
4. **Subagents**: a parent-scoped list of Paseo Subagents and read-only Native subagents, opened from the parent Agent.
5. **Actions**: a separate list containing Back, Follow up, Stop, or Review permission.
6. **Composer / Decision / Handoff**: transcript review, a dedicated Stop decision, or a read-only Permission handoff.

The interaction rules are consistent across views:

| Input | Home / Workspace | Agent | Actions / Composer / Decision |
|---|---|---|---|
| Wheel up/down | Move one semantic item | Browse timeline items only | Move one action or decision |
| Side click | Open the selected item | Open Actions; never execute a side effect | Confirm the explicit selection |
| Side hold | Do not record because the target is ambiguous | Begin dictation for the open agent | Never replace existing content implicitly |
| Side release | No action | End recording and enter transcribing | No action |
| Touch | Select or open | Open activity or Actions | Edit, select, confirm, or cancel |

Workspace, Subagents, Actions, Handoff, and Decision/list views provide a wheel-focusable **Back** semantic item or command. Composer instead exposes `CANCEL` and `SEND`, with Cancel selected by default. Agent reserves wheel focus for timeline items; its hardware return path is side click, then Actions, then Back. Touch back and any later verified RabbitOS back event map to the same cancel/return commands; neither is the only return path.

### 5.2 Home And Workspace

Home shows `Needs attention` first, followed by workspaces grouped under projects. An attention row includes both workspace and agent title. A workspace row includes project name and aggregate activity/attention.

Workspace shows a pinned Back item followed by root Agent sessions. It never flattens Subagents into that list. Each Root Agent exposes its relationship home through `SUBAGENTS · n`; Native subagents stay there, have no independent Workspace ownership, and show `READ ONLY`. A cross-Workspace managed Subagent is also discoverable through a separate `RELATED SUBAGENTS · n` group in its execution Workspace, with both `RUNS IN` and `PARENT` breadcrumbs. Missing/archived parent shows `PARENT UNAVAILABLE`. Home Attention, Parent list, and Execution Workspace share one entity/status and deduplicate by `Host + identity + attentionVersion`, while Back returns to the opening source.

The MVP binds one host. If multiple hosts are added later, Home must label the host on project or workspace rows; workspaces from different hosts must not be flattened together.

### 5.3 Agent View

The first screenful answers three questions:

- What is this agent doing?
- Does it need me?
- What can I do next?

It shows:

- Workspace/agent title and global TransportState/Freshness
- Orthogonal TransportState, Freshness, AuthState, Compatibility, Agent lifecycle, and Attention reason
- Latest assistant summary or latest meaningful timeline item
- A compact progress indicator when structured steps exist
- A fixed Actions entry point

Raw tool logs are collapsed into short descriptions. Long output is truncated on the server projection, with an explicit indication that more content exists.

The wheel changes timeline focus only. Side click opens Actions, which contains Back, Follow up, Stop, or Review permission. New timeline events never steal focus.

Action availability: Root and managed Subagents may Follow up only while `idle/running` and every security gate passes; pending Permission disables Follow-up. Stop appears only for `running` with the turn-safe contract. `initializing/error/closed` and Native subagents expose no Controlled Actions. Stale/offline/syncing or missing grant/lock/security/compatibility gates disable actions with a short reason. Structurally unsupported actions are hidden; transiently blocked actions remain disabled. The server revalidates daemon-verifiable conditions; device lock remains a local gate without OS attestation.

State is not one `working/waiting/done/offline` value. Keep these canonical dimensions separate: TransportState (`unpaired/offline/connecting/syncing/online`), Freshness (`stale/syncing/live`), AuthState (`unauthorized/active/auth-required`), Compatibility (`supported/limited/upgrade-required/unsupported`), Agent lifecycle (`initializing/running/idle/error/closed`), Attention reason (`permission/error/finished/none`), and Workspace status bucket (`needs_input/failed/running/attention/done`).

R1 keeps a separate local Read state that may weaken already-viewed presentation but never creates Attention or changes Workspace status. Each `finished/error` Attention carries a stable version or source turn/event identity. Clear is attempted once and idempotently only when identity matches, projection schema validates, content is non-empty, truncation shows `MORE IN PASEO`, DOM commit succeeds, and the page remains `LIVE`. Finished uses the matching turn's assistant summary or terminal result; Error uses the matching failure's normalized title, summary, and next step. Clear failure never optimistically hides Attention; missing content shows `CONTINUE IN PASEO`. Stale viewing never clears Attention. Permission disappears only when resolved or expired.

### 5.4 Voice Follow-Up

1. The user holds the side button from an explicitly open Agent.
2. The client enters `recording` and invokes the native Creation voice bridge.
3. Release enters `transcribing`; the bridge returns a transcript or error.
4. Composer enters `review` and shows the complete transcript.
5. Explicit Send enters `sending`; an RPC acknowledgement produces `accepted`, a definite failure retains the text in `failed`, and an indeterminate result enters `unknown` without retry.
6. The timeline and command-result query reconcile by commandId; only the authoritative appearance of that same command identity produces `confirmed` and clears the Draft.

Voice input never sends automatically after transcription. The touch-free core path offers `SEND` or `CANCEL`; an incorrect transcript is canceled and dictated again. Touch keyboard editing is optional acceleration and does not become an MVP success condition until OSK height, focus, and target-language input work on real hardware.

This is composer dictation, not Paseo Voice mode. New dictation appends to an existing draft by default; replacement is explicit and cancelable.

If transcription fails, Composer enters `voice-failed` with any pre-existing draft unchanged. Retrying dictation appends content only after transcription succeeds.

Capture preDictationDraft before recording. Canceling that review restores it; only a separate `DISCARD DRAFT` deletes the complete Draft. Confirmed Send clears it, while sending/accepted/unknown/failed retain it. Another Agent never overwrites or receives the Draft: recording first shows `DRAFT IN <Agent>` with only `RETURN TO DRAFT` or explicit discard. A closed/archived/unavailable target disables Send. Persistent Draft TTL is 24 hours.

The input controller trusts RabbitOS `sideClick / longPressStart / longPressEnd` instead of guessing a hold threshold. `longPressStart` consumes the gesture through `longPressEnd` and suppresses one trailing click; Phase 0A measures the suppression window. Too-short audio shows `TOO SHORT`; a 30-second safety limit ends capture and enters review. Transcribing/sending/stopping/unknown reject reentry. A missing `longPressEnd` reaches a safety timeout, fails, and never submits an empty transcript.

### 5.5 Permission Handoff

The first Controlled Actions release never approves or denies Permission on R1. It shows the request kind, title, safely displayable detail summary, completeness state, and complete Host / Workspace / Agent context. `CONTINUE IN PASEO` is status copy, and `BACK` is the only executable action. The user manually opens an already paired phone or desktop Paseo, where the same server Permission Attention appears. The first release creates no handoff token, QR, push, or cross-device deep link. Unknown, malformed, truncated, or changed requests never expose Approve or Deny.

Reconsider device decisions only after a real request corpus proves a stable subset and an allowlisted provider adapter can produce a `Device decision` containing request ID, content fingerprint, complete details, and stable action IDs. R1 must submit `selectedActionId`; it never infers behavior from labels, position, or generic yes/no.

Stop cancels only the exact turn the user reviewed; it never closes, archives, detaches, or deletes a domain object. The command carries `agentSessionId + targetTurnId/generation + commandId`, and the server atomically rejects it if a successor turn has begun, returning `TURN CHANGED`. A dedicated confirmation selects Cancel by default. RPC acceptance means only that the request was received. Stopped appears only after a terminal event or authoritative snapshot correlated to the same target turn. After disconnect, query by commandId rather than blindly resending. If Paseo cannot provide stable turn identity and conditional cancellation, Follow-up may ship but Stop is deferred. Native subagents remain read-only, and all other lifecycle management stays in full Paseo.

## 6. Client Architecture

The Creation remains deliberately small and is divided into five responsibilities:

- **Bridge adapter**: normalizes RabbitOS events, speech-to-text, secure storage, and feature detection.
- **Transport**: pairing, authenticated requests, secure WebSocket lifecycle, retry, and resume.
- **Store**: bounded normalized state for projects, workspaces, agents, attention, activity, connection, composer, and pending actions.
- **Views**: fixed-size Home, Workspace, Agent, Actions, Composer, Decision, Pairing, Offline, and Upgrade Required screens.
- **Input controller**: maps wheel, side button, keyboard fallbacks, and touch to semantic commands.

The device code should use TypeScript and a lightweight build pipeline. A small component library is acceptable, but the runtime should avoid a large framework unless measurement on real hardware proves it stays responsive. Plain DOM rendering or a minimal reactive library is preferred for the first prototype.

The client must cap retained data. As a starting limit:

- 12 workspaces and 30 agents in memory
- 50 projected activity items for the open agent
- 8 KiB rendered text per activity item after projection
- One active transport connection
- No hidden animated views or background timers beyond reconnect and heartbeat

These are initial engineering limits and may change after device profiling.

Directory loading is bounded and attention-first. Every page returns the minimal entities and context needed for unresolved Attention before ordinary Workspace/Agent rows, plus `totalAttention`, a stable continuation cursor, and a truncation reason. Memory limits never silently discard returned Attention. If all unresolved Attention cannot fit, Home retains the highest-priority rows and continuation and pins `MORE ATTENTION IN PASEO · n`; the client cannot claim that there is no Attention. Ordinary directory overflow similarly shows `MORE IN PASEO`.

## 7. Server-Facing Contract

### 7.1 Compatibility Spike

First implement a small browser client that uses the pinned adapter to exercise the existing Paseo handshake, Relay offer, agent subscription, follow-up, stop, and permission flows.

The spike must answer:

- Can a Creation use the current transport and frame encoding?
- Can the existing Relay offer establish an E2EE browser transport for the owned-device private spike? It is already known not to provide a cryptographic read-only scope.
- Can reconnect resume without downloading an unbounded timeline?
- Are browser origin, TLS, and relay constraints compatible with a hosted Creation?
- Which messages require a smaller server-side projection?

Use the current transport through the pinned adapter by default. Paseo safety projection/data minimization, authorization, compatibility, and command-safety extensions are unconditional release work. A separate projection gateway remains conditional on measured performance or protocol gaps.

### 7.2 Required R1 Authorization And Command Extensions (TO-BE-BUILT)

Current Paseo does not provide Device enrollment/grants/scopes/revocation, durable command deduplication and result queries, or turn-safe conditional Stop. Phase 2 therefore adds these contracts regardless of whether a projection gateway is needed:

- One-time Device enrollment, Host-bound grants, short-lived Device sessions, scope elevation, Device management, and immediate revocation.
- Stable commandId, durable server-side deduplication, and command-result query for every releasable Follow-up or Stop.
- Stable target-turn identity and atomic conditional cancellation before Stop exists.
- Server-side enforcement of target type, lifecycle, Device session, grant scope, compatibility, and turn preconditions. Device lock remains a Tested-firmware release/local gate unless RabbitOS later provides trustworthy attestation.
- Protocol/minimum-client compatibility exchange before the first distributable Phase 2A release.
- Server-enforced safety projection and data minimization, including attention-first bounded directories and no raw terminal/tool payloads on R1.

These are new Paseo authorization and command contracts, not capabilities observed in the current SDK or daemon.

### 7.3 Current Sync And Projection Contract

Current Paseo does not expose one unified monotonic stream cursor across directories and timelines. On reconnect, the adapter must:

- Refetch or resubscribe Project, Workspace, Agent, Subagent, and Attention directories.
- Reconcile each open Agent timeline using its own available epoch/sequence or authoritative paged snapshot semantics.
- Keep cached data `STALE` or `SYNCING` until directory and per-Agent reconciliation both complete.
- Reconcile Controlled commands separately by commandId through the new result-query contract.

The client never assumes that WebSocket connection means complete state. Paseo enforces safety/data-minimization invariants before sending data; the local adapter preserves them, and a measured gateway may later optimize the same contract:

- Preserve stable host, project, workspace, agent, activity, command, and permission identifiers.
- Preserve Freshness, literal Agent lifecycle, Workspace aggregate activity, and Attention reason separately; never project them into one state value.
- Preserve parentAgentId, managed/native ownership, and read-only capability.
- Receive deterministic server-generated summaries instead of verbose raw tool input/output.
- Strip terminal control sequences and unsupported rich content.
- Send plain text plus a small supported formatting subset.
- Mark truncation explicitly.
- Keep enough command correlation data to reconcile optimistic UI after reconnect.

Projection must not use an LLM merely to make the stream fit. Deterministic truncation and existing structured summaries are predictable, fast, and private.

### 7.4 Conditional Projection Gateway

Only real-R1 measurements proving an unacceptable bundle/memory cost, Relay frame or timeline volume, browser incompatibility, or protocol-performance gap justify a narrow versioned gateway. Safety projection/data minimization, Device enrollment, grant/session authorization, compatibility exchange, command reconciliation, and turn-safe Stop are not conditional on that trigger.

## 8. Pairing And Security

The Creation installation QR and Paseo device pairing are separate concepts:

- The installation QR identifies the hosted client URL and display metadata.
- The existing Paseo Relay offer carries Host identity, Relay endpoint, and the public key required for E2EE. Its holder is a trusted daemon operator; it is not an R1-specific authorization.

Phase 0A, 0B, and Phase 1 may import an existing Relay offer from a trusted Paseo client on the owned device. The credential still carries trusted operator authority; “read-only” describes only the R1 UI, not a cryptographic scope. These phases are private dogfood, never a distributed product, and the offer never enables Follow-up, Stop, or Permission by itself.

The production controlled-action flow is:

1. Install the Creation from its public or self-hosted installation QR.
2. The user creates a five-minute, one-time enrollment code in trusted full Paseo.
3. The user enters the short code on R1; it establishes only a commandless enrollment session.
4. R1 and trusted Paseo show the same verification words/code, R1 identity, and only the scopes supported by the installed release.
5. After approval in trusted Paseo, the daemon issues an independently revocable Device grant bound to that R1 identity.
6. Store the grant, Draft, snapshot, and any minimal unresolved command receipt in secure Creation storage. Without secure storage, only read-only distribution may run session-only; Follow-up and Stop do not ship, and the client never falls back to long-lived `localStorage`.
7. On each connection, exchange the valid grant for a short-lived Device session after the daemon rechecks scopes and protocol compatibility. The client also applies its Tested-firmware device-lock gate locally.

The state machine is `UNPAIRED -> ENTER CODE -> CONNECTING -> VERIFY CODE -> AWAITING APPROVAL -> ACTIVE | DENIED | EXPIRED`. Denial, expiry, or cancel leaves no partial credential; revocation immediately moves an online R1 to `AUTH REQUIRED` and wipes local sensitive state. The flow does not require an R1 camera. This is a TO-BE-BUILT authorization protocol, not an existing Paseo capability.

Device grants must:

- Be revocable independently.
- Bind to exactly one Host. `read` covers current and future Projects, Workspaces, Agents, Subagents, and Attention on that Host; another Host requires a new enrollment.
- Start with `read`; add `follow-up` or `stop` only when the installed release supports that capability and the user approves the expanded scope again in trusted Paseo.
- Never expand because the Creation was upgraded. A downgrade or compatibility failure may only remove effective capability.
- Never expose provider credentials or agent CLI credentials.
- Remain valid until explicit revocation, device reset, or loss of a required security capability; do not force periodic re-enrollment.
- Issue short-lived, automatically rotated Device sessions and invalidate all of them immediately when the grant is revoked.
- Be redacted from logs and error reports.

Trusted full Paseo must provide Device management before Phase 2A can exit. Each enrolled R1 shows a user-recognizable name, stable device identity, bound Host, approved scopes, immutable Creation release version, Tested firmware state, last-seen time, and `ACTIVE`, `REVOKED`, or `SECURITY BLOCKED`. From this surface the user can confirm `REVOKE DEVICE` or explicitly elevate to `ENABLE FOLLOW-UP` and later `ENABLE STOP`. Revocation succeeds while the R1 is offline, invalidates the grant immediately, and forces `AUTH REQUIRED` on its next connection.

The Host-wide `read` scope does not expose provider or agent CLI credentials, daemon administration, raw filesystem access, or unprojected timeline/tool payloads. The first release has no Workspace allowlist: new Workspaces on the bound Host become visible automatically, while changing Host always requires a new enrollment.

Phase 1 read-only private dogfood does not require a device lock. Every distributable release, including read-only Phase 2A, requires an audited immutable bundle, a Device grant containing only that release's approved scopes, and a reliable lock enabled on the Tested firmware. This is a release and client-local capability gate; without OS-backed attestation the daemon must not claim to verify lock state per command. The Creation does not implement or store another long-lived PIN. If this physical-security prerequisite cannot be verified, the project remains a private experiment. Unpairing or authentication invalidation immediately clears local sensitive state.

Before importing a Relay offer, reading a grant, or requesting sensitive data, complete the firmware and security-capability gate. Cross-restart persistence uses secure Creation storage only and is limited to the grant, one target-bound Draft, a minimized 24-hour Snapshot cache, and one unresolved command receipt. The receipt stores only commandId, kind, target identities, target turn for Stop, state, and timestamps; it contains no prompt, transcript, timeline, or tool payload. Persistent data has a schema/version, strict capacity limit, and corruption recovery. Without secure storage, distributable read-only capability may run session-only, but Follow-up and Stop do not ship.

The daemon's Device-grant authorization extension must revalidate the grant on reconnect and enforce the current Device session, scope, compatibility, target lifecycle, and turn preconditions for every command; hiding a button in the Creation is not authorization. It must not treat a client-reported lock boolean as attestation. It must also validate WebSocket origins where deployment topology permits, rate-limit pairing and commands, and require TLS outside explicitly enabled local development.

The production MVP supports Paseo Relay only. Direct/LAN connections are limited to controlled development diagnostics and do not appear in first-release pairing or support surfaces. The production client must not offer an option to disable certificate validation.

## 9. Connection And Failure Behavior

The transport state machine is explicit and is combined with, not substituted for, the separate Freshness, AuthState, and Compatibility dimensions defined in Section 5.3:

```text
unpaired -> connecting -> syncing -> online
                |            |         |
                v            v         v
              offline <------+---------+
                |
                +-> auth-required
                +-> upgrade-required
```

Required behavior:

- Use exponential backoff with jitter and a maximum delay.
- Pause aggressive retries when the page is hidden or RabbitOS suspends it.
- On resume, reconnect, refetch/resubscribe directories, and reconcile each open Agent from its own timeline epoch/sequence or authoritative snapshot.
- Retain at most one Follow-up Draft bound to a Host, Workspace, and Agent session. A Draft is not a pending command, and no operation is queued offline.
- Controlled commands use stable commandIds; the server durably deduplicates them and supports result queries so reconnect cannot duplicate Follow-up or Stop.
- Before socket write, atomically persist a payload-free command receipt. A command written with an unknown result enters `UNKNOWN`; reconnect or process restart reconciles that receipt before enabling any new Controlled command, and a still-unknown result shows `CHECK PASEO` rather than guessing.
- Show stale cached state as stale, never as live.
- Clear sensitive state when the device is unpaired.
- Offline users may read stale snapshots and edit the existing Draft, but Send and Stop are disabled. Changing Agent never moves the Draft. After reconnect, show the target and latest context again and require another explicit Send; never auto-send.
- Without secure storage, keep read-only authorization, Draft, and snapshot only for the current Creation session and do not expose Follow-up or Stop. Viewing stale content never clears Attention or writes Read state.

## 10. Deployment And Operations

The client is a versioned static web bundle served over HTTPS. An installation page generates the Rabbit R1 Creation QR payload containing the title, client URL, description, icon, and theme color.

Phase 0A/0B uses a temporary HTTPS tunnel for hardware development. Phase 1 may use private versioned static hosting for owned-device dogfood. The first distributable release uses an audited independent HTTPS static origin with an immutable path per version, for example `/r1/v0.1.0/`. The installation QR always identifies one explicit version; an upgrade publishes a new URL rather than overwriting an old bundle. This is an operational control, not cryptographic proof against origin replacement.

### 10.1 Production Static Hosting

Official or personal deployments publish the complete static directory on an HTTPS origin. The QR library required by `install.html` is vendored or bundled; production installation never depends on a runtime third-party CDN. The R1 bundle reaches the daemon only through Paseo Relay.

Production hosting uses a strict CSP, minimal origin write access, vendored dependencies, and a recorded audit digest. The digest supports release review but is not device attestation. The current product trusts the official or self-hosted static-origin operator; resisting a malicious or compromised origin requires RabbitOS-supported signed-bundle verification or attestation and is outside the current boundary.

### 10.2 Self-Hosting

Self-hosters publish the same immutable static directory on their own HTTPS host. The Paseo daemon does not distribute production Creation assets; it owns Relay/WebSocket, Device grants, and product protocol.

Phase 2A must add the client/daemon protocol and minimum-client compatibility exchange before any distributable release. Incompatible versions fail closed and show Upgrade Required. Phase 3 improves upgrade UX, diagnostics, and operational signals rather than creating this security gate.

Operational signals should include:

- Connection and authentication failures by reason
- Snapshot and replay sizes
- Command latency and rejection reason
- Reconnect frequency
- Client version and negotiated protocol version

Telemetry is opt-in and should default to local structured logs. No prompt, response, transcript, token, or provider credential is sent to a third-party analytics service.

## 11. Verification Plan

Browser simulation is useful but not sufficient. The release gate requires a real Rabbit R1.

### 11.1 Automated Tests

- Input controller tests for wheel, side click, hold/release, touch, and fallback keyboard events
- Gesture-race tests for trailing click, repeated start/end, too-short audio, 30-second limit, missing end, pending-state reentry, and suspend interruption
- Store tests for snapshots, replay, duplicates, out-of-order commands, and stale events
- Draft tests for pre-dictation restore, same-target append, cross-target conflict, explicit discard, unavailable target, confirmed clear, and 24-hour expiry
- Secure-storage tests for capability-before-data, 24-hour TTL, capacity limits, suspend/restart, wipe, and corrupted-data recovery
- Command-receipt tests for atomic pre-write persistence, payload absence, process restart, reconciliation-before-new-command, terminal cleanup, and unavailable secure storage
- Transport tests for disconnect points, `UNKNOWN`, command-result query, directory refetch/resubscribe, per-Agent timeline catch-up, authentication expiry, and durable deduplication
- Projection contract tests against representative Paseo timeline and permission events
- Attention-directory tests for attention-first ordering, stable continuation, overflow counts, and `MORE ATTENTION IN PASEO` without silent loss
- Action-capability tests across target type, lifecycle, pending Permission, transport/freshness/auth/compatibility, grant, the local device-lock gate, turn identity, and server-side enforcement of daemon-verifiable conditions
- Attention-clear tests for version/source identity, Meaningful-content readiness, idempotent clear, failure retention, and cross-client results
- Layout screenshots at exactly 240×292 CSS pixels
- Bundle-size and maximum-DOM-node checks

### 11.2 Hardware Scenarios

- Install from a new QR and pair with a clean device state
- Use only the wheel and side button to move through Root Agents, Parent Subagents, and cross-Workspace Related Subagents
- Follow a long-running Codex or Claude Code task for ten minutes
- Complete dictation, full review, Send, and Cancel using the side button; explore touch text editing separately
- Verify font metrics, wrapping, truncation, and glyph coverage for Chinese Project/Workspace/Agent titles, timeline content, and transcripts
- Verify that representative Permission shapes expose only safe summaries, `CONTINUE IN PASEO`, and `BACK`, plus successful/rejected/timed-out Stop
- Disable Wi-Fi during streaming, restore it, and confirm directory plus per-Agent timeline recovery
- Restart the Paseo daemon and confirm state recovery
- Suspend and wake the R1 repeatedly
- Revoke the Device grant while R1 is online and offline; confirm all derived Device sessions are invalidated and R1 returns to `AUTH REQUIRED`
- Upgrade the server beyond the supported client range and confirm a clear upgrade screen
- Run the full matrix on Tested firmware; simulate unknown firmware, a degradable missing capability, and a security-critical missing capability to verify `LIMITED` and `UNSUPPORTED`
- Exercise authorization denial, expiry, cancel, code replay, verification mismatch, rate limiting, scope elevation/downgrade, Device reset, online/offline grant revocation, and invalidated derived sessions

Product success requires seven consecutive days of dogfood in real personal work:

- At least 80% of away-from-desk interventions complete without opening Paseo on a phone or desktop
- Median time from opening R1 to identifying the highest-priority Attention is at most three seconds
- Median time to complete a safe Follow-up is at most 20 seconds
- Zero wrong-target, duplicate-submit, mistaken-approval, or mistaken-Stop events
- Cached content never shows `LIVE` before synchronization completes

Measurement definitions: an Intervention session begins at the first foreground/boot event after at least five minutes closed or backgrounded, and ends on exit or 60 seconds of inactivity. An Eligible intervention completes `LIVE` synchronization and either confirms no Attention or opens the highest-priority Attention/Agent. Permission handoff counts as a non-R1-only outcome and stays in the denominator. Identify time ends when the highest-priority live Attention is fully displayed and focused. Safe Follow-up time ends when the same command identity is confirmed in the authoritative timeline. Seven days must include at least 20 Eligible sessions and 10 Controlled commands.

Engineering release gates:

- Initial interactive screen within three seconds on a normal Wi-Fi connection, excluding first-time pairing
- Wheel selection feedback within 100 ms
- Controlled commands reconcile by commandId across forced reconnects without loss, duplication, or blind retry
- No unbounded growth in DOM nodes or retained activity during a 30-minute session
- All core flows operable without precise touch input
- A safety matrix covers every disconnect point, duplicate/replay, target-Agent switch, successor-turn race, stale snapshot, and grant revocation

## 12. Risks And Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| RabbitOS changes or removes Creation bridge APIs | Input or voice stops working | Feature detection, firmware compatibility matrix, keyboard/touch fallbacks |
| Current Paseo protocol is too heavy or browser-incompatible | Prototype stalls on transport work | Time-boxed compatibility spike and versioned projection gateway |
| Small display makes Permission unsafe | User approves the wrong operation | Keep the first Controlled Actions release read-only; future eligibility requires a real corpus and allowlisted adapter |
| Hosted Creation introduces supply-chain risk | Client bundle could be replaced | Trust-boundary disclosure, strict CSP, vendored dependencies, origin access control, audit digest, self-host option; signed-bundle attestation is not currently available |
| Credentials leak through storage or logs | Unauthorized agent control | Scoped revocable tokens, secure storage, redaction, no provider secrets on device |
| WebView is suspended aggressively | Missed live events | Directory refetch/resubscribe plus per-Agent timeline catch-up; correctness does not depend on background execution |
| Timeline volume overwhelms the device | Poor responsiveness or crashes | Server projection, strict bounds, no raw terminal stream |
| Community API observations differ across firmware | Device-specific failures | Maintain a tested firmware matrix and verify on the target device before release |

## 13. Delivery Plan

### Phase 0A: Hardware Capability Probe

- Run the existing `demo/` on the owned R1 to exercise viewport, wheel/side events, and the STT bridge surface; it is not evidence for WSS, secure-storage read/write, firmware capture, or suspend/resume.
- Record the target RabbitOS firmware and add direct hardware checks for secure-storage read/write, HTTPS/WSS, and suspend/resume.
- Produce a firmware capability matrix; desktop mock results never substitute for hardware evidence.

Exit criterion: every Creation contract has a real-device result, fallback, and blocker record. The current `demo/` belongs only to this phase.

### Phase 0B: Private Transport Vertical Slice

- Use an existing Relay offer, Relay E2EE, and the pinned adapter to connect to a real daemon.
- List Workspaces and Attention, open one Agent, and subscribe/reconcile its timeline.
- Send one non-destructive test Follow-up. This is a private spike, not a product release.
- Measure bundle, memory, frame size, and compatibility; propose a gateway only if a trigger is proven.

Exit criterion: the real R1 completes this vertical path and reconciles directory/timeline state after reconnect. Any indeterminate test Follow-up is recorded explicitly as `UNKNOWN`; the phase must not claim durable dedupe or duplicate prevention before Phase 2B.

### Phase 1: Read-Only Client

- Use an existing Relay offer to implement read-only connection state, Home Attention, Project/Workspace, Root Agent, Subagents, timeline reconciliation, and stale/offline behavior.
- Add browser-level automation and exact-viewport screenshots.
- Test suspension, daemon restart, and invalidated Relay offer on hardware.
- Label the phase as owned-device private dogfood; never claim UI-only read-only is a credential scope or distribute it as a product.

Exit criterion: the R1 can monitor multiple workspaces and their agents/subagents for 30 minutes without semantic crossover between transport, freshness, auth, compatibility, lifecycle, aggregate activity, and attention, without silent Attention loss beyond memory limits, or unbounded resource growth.

### Phase 2A: Controlled Actions Security Foundation

- Serve an audited immutable bundle and implement Device enrollment/grants, identity binding, scope enforcement, and immediate revocation.
- Issue a `read`-only grant; later phases require explicit scope elevation in trusted Paseo.
- Add the trusted-Paseo Device management surface for identity, scopes, release/firmware, last seen, state, elevation, and offline revocation.
- Verify the target firmware's RabbitOS device lock and require the owner to enable it; Phase 2A cannot be distributed when it cannot be verified.
- Add protocol/minimum-client negotiation that fails closed on incompatibility.
- Require secure storage for persistent grants; otherwise allow only read-only distributable capability in session-only mode, with enrollment and synchronization required again after restart.

Exit criterion: enrollment, grant issuance, scope enforcement, the Device management surface, offline independent revocation, protocol/minimum-client negotiation, secure storage, device-lock gating, and the immutable release path pass their security matrix. Failure to verify the lock blocks distribution. No Controlled Action is enabled yet.

### Phase 2B: Follow-Up

- Add Composer dictation, complete review, Send/Cancel, and target-bound Draft recovery.
- Require a separately approved `follow-up` scope; installing or upgrading the beta cannot add it automatically.
- Require secure storage and implement payload-free command receipts, stable commandIds, durable deduplication, result queries, and idempotent reconciliation before enabling Send.
- Collect a real Permission request corpus while keeping device decisions as read-only handoff.

Exit criterion: Follow-up passes disconnect-at-every-boundary, process-restart receipt recovery, duplicate/replay, target-switch, grant-revoke, and `UNKNOWN` reconciliation tests without a wrong-target or duplicate command. A distributable `Follow-up-only beta` may ship at this point only with secure storage; Stop remains completely absent from its grant scopes and UI.

### Phase 2C: Turn-Safe Stop

- Add Stop only after stable turn identity and server-side conditional cancellation are available.
- Require a new trusted-Paseo approval to add `stop`; older grants remain Follow-up-only.
- Bind confirmation and result correlation to the exact target turn and protect every successor-turn race.

Exit criterion: target-turn precondition, atomic rejection after a turn change, success correlation, command-result query, and successor-turn protection all pass. Only then does Stop enter the Device grant scope and release surface.

### Phase 3: Packaging And Daily Use

- Require Phase 2C completion; a Follow-up-only beta is not the daily-use release defined by this plan.
- Serve immutable releases and generate installation QR codes.
- Improve upgrade messaging, compatibility diagnostics, and local diagnostics; negotiation itself is already a Phase 2A gate.
- Document self-hosting through Paseo and relay-based remote access.
- Run battery, suspension, and connectivity trials plus seven consecutive days of dogfood.

Exit criterion: the client is suitable for personal daily use without development tooling attached and meets the Section 11 product success gates.

### Phase 4: Native Android Evaluation

Evaluate a native APK only if measured Creation limitations block a desired workflow. Record the exact limitation and demonstrate that native Android resolves it before accepting bootloader or custom-ROM complexity.

Possible native-only goals include background notifications, richer audio behavior, direct camera control, or launcher integration. Native development on stock RabbitOS and custom firmware are separate decisions and must not be conflated.

## 14. Open Decisions

The following implementation inputs must be resolved during the indicated phase:

1. Can the current Paseo WebSocket and binary framing run reliably in the RabbitOS WebView?
2. Can the current Relay offer bootstrap the owned-device private transport spike? It is not eligible to replace the TO-BE-BUILT Device grant.
3. Do real-device measurements trigger a performance projection gateway, and if so, what is the minimum boundary beyond the unconditional safety projection?
4. During later Permission research, does a real corpus support a provably complete `Device decision` allowlist? This is not a Phase 0 or first Controlled Actions release dependency.
5. Does the target RabbitOS firmware provide secure Creation storage and native speech-to-text with the community-observed contract?
6. Is Paseo Relay usable directly from a hosted Creation, including origin, TLS, E2EE crypto primitive, and frame-size requirements?
7. Does RabbitOS expose a reliable back event; if not, are focusable Back items in list/decision views plus Agent → Actions → Back efficient enough on hardware?

These are implementation inputs, not reasons to expand the MVP. Until answered, the conservative defaults are a pinned local adapter, read-only activity projection, and no device-side permission support.

## 15. References

- [Paseo](https://github.com/getpaseo/paseo)
- [Awesome Rabbit R1](https://github.com/sayhiben/awesome-rabbit-r1)
- [Rabbit R1 Creations examples](https://github.com/andr3w-hilton/rabbit-r1-creations-public)
- [R1 UI Kit](https://github.com/Ashosystem/r1-ui-kit)
- [Warren agent bridge](https://github.com/dkta0/warren)
- [Rabbit R1 hooks for Claude Code and Codex](https://github.com/sarkarsaurabh27/rabbit-r1-hooks)
- [R1 Escape](https://github.com/RabbitHoleEscapeR1/r1_escape)
- [Rabbit R1 firmware guide](https://github.com/TurboTheTurtle/rabbit-r1-firmware)
- [Rabbit R1 boot notes](https://github.com/DavidBuchanan314/rabbit_r1_boot_notes)
