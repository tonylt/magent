# Rabbit R1 Paseo Client: Solution Design

[简体中文](rabbit-r1-paseo-client-design.zh-CN.md) | English

Status: Proposed  
Date: 2026-07-17  
Audience: Engineers implementing or reviewing the first Rabbit R1 client for Paseo

## 1. Purpose

This document defines an implementable first version of a Paseo client for Rabbit R1. After reading it, an engineer should be able to split the MVP into work items, implement the device client and its server-facing adapter, and verify the result on real hardware.

The client turns Rabbit R1 into a compact remote control for coding agents that run through Paseo on another machine. It is optimized for checking work, sending short follow-ups, and handling decisions while away from a desktop. It is not intended to reproduce the complete Paseo mobile or desktop interface.

## 2. Goals And Non-Goals

### 2.1 Goals

- Install and update the client without unlocking or reflashing Rabbit R1.
- Connect securely to an existing Paseo installation over a local network or remote relay.
- Show attention items with their host, project, workspace, and agent-session context in a form readable on the R1 display.
- Open an agent within its workspace context and follow its most relevant recent activity.
- Send a typed or push-to-talk follow-up.
- Stop a running agent and respond to supported permission requests.
- Work primarily through the scroll wheel and side button, with touch as a secondary input.
- Recover coherently from suspension, network loss, daemon restart, and stale credentials.

### 2.2 Non-Goals For The MVP

- Running coding agents or the Paseo daemon on Rabbit R1.
- Reproducing the full timeline, terminal emulator, file explorer, diff viewer, or workspace manager.
- Reusing the existing phone layout unchanged.
- Replacing the RabbitOS launcher or voice assistant.
- Requiring bootloader unlock, root, Magisk, AOSP, or CipherOS.
- Supporting arbitrary third-party Paseo extensions on the device.
- Editing source code on the R1.

## 3. Device And Platform Constraints

The MVP runs as a RabbitOS Creation, a hosted WebView application installed from a QR payload.

The following constraints are treated as product requirements:

- The effective Creation viewport is 240 by 282 CSS pixels. The physical display resolution is not the application layout size.
- The scroll wheel dispatches discrete up and down events. It should move selection, not imitate high-resolution inertial scrolling.
- The side button provides short-click and press-and-hold events. Push-to-talk is the primary composition path.
- Native speech-to-text returns a completed transcript through the Creation bridge. The client does not own raw microphone streaming in the MVP.
- Touch is available, but targets must remain usable without precise touch input.
- The WebView has limited rendering capacity. Large DOM trees, rich Markdown, WebGL, continuous animations, and unbounded logs are inappropriate.
- The client is loaded from HTTPS. Remote connections must use secure WebSocket or HTTPS endpoints.
- Creations are cached by installation URL. Releases need versioned URLs or equivalent cache busting.
- Device bridge features vary by RabbitOS version. Every native API must be feature-detected, with a visible fallback or an explicit unsupported state.

Community experiments show that a Creation can use the scroll wheel, side button, native speech-to-text, secure storage, sensors, HTTPS, Server-Sent Events, and WebSocket connections. These capabilities are sufficient for the proposed client.

## 4. Solution Choice

### 4.1 Selected Approach

Build a dedicated Rabbit R1 Creation and expose a narrow, versioned device API in front of Paseo.

```text
Rabbit R1
Creation WebView
  - agent list
  - activity summary
  - PTT and text input
  - stop and permission actions
        |
        | HTTPS + secure WebSocket
        v
R1 client gateway
  - pairing and device tokens
  - protocol versioning
  - filtering and projection
  - reconnect and resume support
        |
        | Paseo client contract
        v
Paseo daemon / relay
        |
        v
Claude Code, Codex, Copilot, OpenCode, Pi
```

The R1 client gateway is a logical boundary, not necessarily a separate deployable service. It may be implemented inside the Paseo server if that keeps authentication and event projection simple. It may begin as a small companion process if changing Paseo would slow down the first hardware prototype.

### 4.2 Why Not Use The Existing Paseo App Directly

The existing Expo client is designed for phone, tablet, web, and desktop layouts. Even its compact layout assumes substantially more space and input precision than a Creation provides. Loading the complete application would also bring unnecessary navigation, retained panels, terminal rendering, file browsing, and state subscriptions onto limited hardware.

The R1 client should share domain contracts and semantics with Paseo, but own its presentation and local state.

### 4.3 Why Not Flash Android First

Community firmware work can run AOSP or CipherOS on the device, but current reports include touchscreen suspend failures, inconsistent side-button support, MediaTek fastboot complications, and recovery procedures that require Linux tooling. None of these risks are necessary to prove the Paseo use case.

Native Android becomes justified only when the Creation sandbox blocks a validated product requirement, such as reliable background connectivity, lower-level audio control, system notifications, or hardware behavior unavailable through the bridge.

## 5. User Experience

### 5.1 Navigation Model

The interface has five primary views:

1. **Home**: attention items followed by workspaces grouped under projects.
2. **Workspace**: root agents, Paseo subagents, and provider-owned child sessions in one workspace.
3. **Agent**: a projected timeline that preserves host, project, and workspace context.
4. **Actions**: a separate list containing Back, Follow up, Stop, or Review permission.
5. **Composer / Decision**: transcript review or a dedicated permission/stop decision surface.

The interaction rules are consistent across views:

| Input | Home / Workspace | Agent | Actions / Composer / Decision |
|---|---|---|---|
| Wheel up/down | Move one semantic item | Browse timeline items only | Move one action or decision |
| Side click | Open the selected item | Open Actions; never execute a side effect | Confirm the explicit selection |
| Side hold | Do not record because the target is ambiguous | Begin dictation for the open agent | Never replace existing content implicitly |
| Side release | No action | End recording and enter transcribing | No action |
| Touch | Select or open | Open activity or Actions | Edit, select, confirm, or cancel |

Workspace, Actions, Composer, and Decision/list views provide a wheel-focusable **Back** semantic item or command. Agent reserves wheel focus for timeline items; its hardware return path is side click, then Actions, then Back. Touch back and any later verified RabbitOS back event map to the same return commands; neither is the only return path.

### 5.2 Home And Workspace

Home shows `Needs attention` first, followed by workspaces grouped under projects. An attention row includes both workspace and agent title. A workspace row includes project name and aggregate activity/attention.

Workspace shows a pinned Back item, root agents, Paseo-managed subagents, and provider-owned child sessions with their read-only capability made explicit.

The MVP binds one host. If multiple hosts are added later, Home must label the host on project or workspace rows; workspaces from different hosts must not be flattened together.

### 5.3 Agent View

The first screenful answers three questions:

- What is this agent doing?
- Does it need me?
- What can I do next?

It shows:

- Workspace/agent title and global connection freshness
- Orthogonal agent lifecycle, attention reason, and connection freshness
- Latest assistant summary or latest meaningful timeline item
- A compact progress indicator when structured steps exist
- A fixed Actions entry point

Raw tool logs are collapsed into short descriptions. Long output is truncated on the server projection, with an explicit indication that more content exists.

The wheel changes timeline focus only. Side click opens Actions, which contains Back, Follow up, Stop, or Review permission. New timeline events never steal focus.

State is not one `working/waiting/done/offline` value. It has three dimensions: connection (`online/reconnecting/stale/auth-required`), lifecycle (`initializing/running/idle/error/closed`), and attention (`needs-input/permission/failed/finished/unread/none`). Idle must not be labeled waiting, and an idle parent can belong to a running workspace because a child is active.

### 5.4 Voice Follow-Up

1. The user holds the side button from an explicitly open Agent.
2. The client enters `recording` and invokes the native Creation voice bridge.
3. Release enters `transcribing`; the bridge returns a transcript or error.
4. Composer enters `review` and shows the transcript.
5. Explicit Send enters `sending`; server acknowledgement produces `accepted`, while failure retains the text in `failed`.
6. The timeline shows a pending item and reconciles it by idempotency key.

Voice input never sends automatically after transcription. Review-before-send prevents accidental instructions caused by speech recognition errors.

This is composer dictation, not Paseo Voice mode. New dictation appends to an existing draft by default; replacement is explicit and cancelable.

If transcription fails, Composer enters `voice-failed` with any pre-existing draft unchanged. Retrying dictation appends content only after transcription succeeds.

### 5.5 Approval Requests

Only complete permission schemas that can be represented unambiguously on the small display are actionable. The client shows:

- Requested operation
- Short reason or affected target
- Schema-appropriate confirm or a complete fixed select containing one or two string options
- Detail completeness and workspace context

The MVP supports only untruncated simple confirms and complete fixed selects containing one or two string options. Text, editor, multi-step questions, optional comments, and schemas that distinguish skip from cancel remain read-only and direct the user to a full Paseo client. Unknown, malformed, or truncated requests default to unsupported and never expose Approve. The server must never convert an unsupported permission into a generic yes/no prompt.

Stop uses a dedicated confirmation with Cancel selected by default. It shows `stopping` until the provider acknowledges the interrupt or emits a terminal turn event. Rejection or timeout returns to running and explains the failure.

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

## 7. Server-Facing Contract

### 7.1 Compatibility Spike

Before finalizing the gateway, implement a small browser client that attempts the existing Paseo handshake, pairing, agent subscription, follow-up, stop, and permission flows.

The spike must answer:

- Can a Creation use the current transport and frame encoding?
- Can existing device pairing produce a scoped credential usable by a browser client?
- Can reconnect resume without downloading an unbounded timeline?
- Are browser origin, TLS, and relay constraints compatible with a hosted Creation?
- Which messages require a smaller server-side projection?

If the current contract passes these checks, the R1 gateway becomes a thin compatibility layer or can be omitted. Otherwise, implement the device API below.

### 7.2 Proposed Device API

The device API is versioned independently from internal daemon messages. Version 1 exposes only the MVP operations.

Request/response operations:

- Exchange a short-lived pairing grant for a device credential.
- List projects/workspaces and attention items with a cursor.
- Fetch root agents, subagents, and provider children for one workspace.
- Fetch the current timeline and capabilities for one agent.
- Send a follow-up with an idempotency key.
- Stop an agent with an idempotency key.
- Resolve a supported permission request.
- Refresh or revoke the device credential.

The event stream emits:

- Project/workspace aggregate activity or attention changed
- Agent added, updated, or removed from a workspace-visible set
- Projected activity appended or replaced
- Agent lifecycle and attention changed independently
- Approval opened, resolved, or expired
- Client command accepted, rejected, or completed
- Session invalidated or minimum client version changed

Every event contains a monotonically increasing stream cursor. After reconnect, the client supplies its last cursor. The server either replays the bounded gap or sends a fresh snapshot. The client never assumes that a WebSocket connection implies complete state.

### 7.3 Projection Rules

The gateway converts Paseo's full domain stream into a device-safe representation:

- Preserve stable host, project, workspace, agent, activity, command, and permission identifiers.
- Preserve connection freshness, literal agent lifecycle, workspace aggregate activity, and attention reason separately; never project them into one state value.
- Preserve parentAgentId, provider-child type, and read-only capability.
- Collapse verbose tool input and output into a short server-generated summary.
- Strip terminal control sequences and unsupported rich content.
- Send plain text plus a small supported formatting subset.
- Mark truncation explicitly.
- Keep enough command correlation data to reconcile optimistic UI after reconnect.

Projection must not use an LLM merely to make the stream fit. Deterministic truncation and existing structured summaries are predictable, fast, and private.

## 8. Pairing And Security

The Creation installation QR and Paseo device pairing are separate concepts:

- The installation QR identifies the hosted client URL and display metadata.
- Paseo pairing authorizes this physical client to access one Paseo installation.

The recommended flow is:

1. Install the Creation from its public or self-hosted installation QR.
2. Open Paseo on a trusted full-size client and create a short-lived pairing grant.
3. Enter or scan that grant on the R1.
4. Exchange it over HTTPS for a scoped device token.
5. Store the token using RabbitOS secure Creation storage when available.

Device tokens must:

- Be revocable independently.
- Be scoped to client operations, not daemon administration.
- Never expose provider credentials or agent CLI credentials.
- Expire or rotate without reinstalling the Creation.
- Be redacted from logs and error reports.

The gateway must enforce authorization for every command; hiding a button in the Creation is not authorization. It must also validate WebSocket origins where deployment topology permits, rate-limit pairing and commands, and require TLS outside explicitly enabled local development.

For local-only deployments without trusted HTTPS, use the Paseo relay or a documented local TLS setup. The production client must not offer an option to disable certificate validation.

## 9. Connection And Failure Behavior

The transport state machine is explicit:

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
- On resume, reconnect and request replay from the last committed cursor.
- Queue at most one unsent follow-up locally. Destructive actions are not queued while offline.
- Use idempotency keys so a reconnect cannot duplicate a follow-up, stop, or permission decision.
- Show stale cached state as stale, never as live.
- Clear sensitive state when the device is unpaired.

## 10. Deployment And Operations

The client is a versioned static web bundle served over HTTPS. An installation page generates the Rabbit R1 Creation QR payload containing the title, client URL, description, icon, and theme color.

Two supported deployment modes are planned:

### 10.1 Paseo-Hosted

The Paseo server serves the static Creation and device API. This provides the simplest self-hosted installation and keeps client and server compatibility aligned.

### 10.2 Independently Hosted

The static client is hosted on a public static host, while it connects to the user's Paseo gateway or relay. This makes installation easy but requires careful origin policy, compatibility handling, and upgrade messaging.

Every release receives an immutable versioned URL. The installation QR points at that version or includes a cache-busting version. The client and gateway exchange protocol and minimum-client versions during connection.

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
- Store tests for snapshots, replay, duplicates, out-of-order commands, and stale events
- Transport tests for disconnect, retry, cursor resume, authentication expiry, and idempotency
- Projection contract tests against representative Paseo timeline and permission events
- Layout screenshots at exactly 240×282 CSS pixels
- Bundle-size and maximum-DOM-node checks

### 11.2 Hardware Scenarios

- Install from a new QR and pair with a clean device state
- Use only the wheel and side button to move from Home through project/workspace into root agents, subagents, and provider children
- Follow a long-running Codex or Claude Code task for ten minutes
- Send voice and edited text follow-ups
- Verify simple confirm, complete one- or two-option fixed select, unsupported/truncated permission, and successful/rejected/timed-out Stop
- Disable Wi-Fi during streaming, restore it, and confirm cursor-based recovery
- Restart the Paseo daemon and confirm state recovery
- Suspend and wake the R1 repeatedly
- Revoke the token from Paseo and confirm the R1 returns to pairing
- Upgrade the server beyond the supported client range and confirm a clear upgrade screen

Acceptance targets for the MVP:

- Initial interactive screen within three seconds on a normal Wi-Fi connection, excluding first-time pairing
- Wheel selection feedback within 100 ms
- No lost or duplicated accepted command across a forced reconnect
- No unbounded growth in DOM nodes or retained activity during a 30-minute session
- All core flows operable without precise touch input

## 12. Risks And Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| RabbitOS changes or removes Creation bridge APIs | Input or voice stops working | Feature detection, firmware compatibility matrix, keyboard/touch fallbacks |
| Current Paseo protocol is too heavy or browser-incompatible | Prototype stalls on transport work | Time-boxed compatibility spike and versioned projection gateway |
| Small display makes detailed permissions unsafe | User approves the wrong operation | Support only explicit schemas; require full client for unknown details |
| Hosted Creation introduces supply-chain risk | Client bundle could be replaced | Immutable versioned assets, integrity checks where supported, self-host option |
| Credentials leak through storage or logs | Unauthorized agent control | Scoped revocable tokens, secure storage, redaction, no provider secrets on device |
| WebView is suspended aggressively | Missed live events | Cursor replay and snapshot recovery; correctness does not depend on background execution |
| Timeline volume overwhelms the device | Poor responsiveness or crashes | Server projection, strict bounds, no raw terminal stream |
| Community API observations differ across firmware | Device-specific failures | Maintain a tested firmware matrix and verify on the target device before release |

## 13. Delivery Plan

### Phase 0: Device And Protocol Spike

- Confirm target RabbitOS firmware and Creation APIs on the owned device.
- Install a minimal Creation that reports wheel, side-button, voice, storage, and network capabilities.
- Test the existing Paseo browser transport from a Creation-like WebView.
- Decide whether the gateway lives inside Paseo or starts as a companion service.

Exit criterion: a real R1 can authenticate, list projects/workspaces and attention, subscribe to one agent, and send a non-destructive test follow-up.

### Phase 1: Read-Only Client

- Implement pairing, connection state, Home attention, project/workspace, agent summary, projection, and reconnect.
- Add browser-level automation and exact-viewport screenshots.
- Test suspension, daemon restart, and token revocation on hardware.

Exit criterion: the R1 can monitor multiple workspaces and their agents/subagents for 30 minutes without semantic crossover between connection, lifecycle, aggregate activity, and attention, or unbounded resource growth.

### Phase 2: Controlled Actions

- Add review-before-send voice and text follow-ups.
- Add stop with explicit confirmation.
- Add the first narrowly supported permission schemas.
- Add idempotent command reconciliation.

Exit criterion: commands remain correct under forced disconnects and every action has an auditable server result.

### Phase 3: Packaging And Daily Use

- Serve immutable releases and generate installation QR codes.
- Add compatibility negotiation, upgrade messaging, and local diagnostics.
- Document self-hosting through Paseo and relay-based remote access.
- Run a multi-day battery, suspension, and connectivity trial.

Exit criterion: the client is suitable for personal daily use without development tooling attached.

### Phase 4: Native Android Evaluation

Evaluate a native APK only if measured Creation limitations block a desired workflow. Record the exact limitation and demonstrate that native Android resolves it before accepting bootloader or custom-ROM complexity.

Possible native-only goals include background notifications, richer audio behavior, direct camera control, or launcher integration. Native development on stock RabbitOS and custom firmware are separate decisions and must not be conflated.

## 14. Open Decisions

The following decisions must be resolved during Phase 0:

1. Can the current Paseo WebSocket and binary framing run reliably in the RabbitOS WebView?
2. Can existing Paseo pairing issue a sufficiently scoped browser credential?
3. Should the first gateway be built into Paseo or deployed as a companion service?
4. Which permission schemas are both common and complete enough for 240×282? The initial ceiling is simple confirm and a complete fixed select containing one or two string options.
5. Does the target RabbitOS firmware provide secure Creation storage and native speech-to-text with the community-observed contract?
6. Is the Paseo relay usable directly from a hosted Creation, including origin and TLS requirements?
7. Does RabbitOS expose a reliable back event; if not, are focusable Back items in list/decision views plus Agent → Actions → Back efficient enough on hardware?

These are implementation inputs, not reasons to expand the MVP. Until answered, the conservative defaults are a companion gateway, read-only activity projection, and no device-side permission support.

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
