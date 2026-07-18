# Rabbit R1 Paseo Companion

This context defines the product language for a small companion surface that monitors and controls Paseo agent sessions from Rabbit R1. It inherits Paseo's domain terms and narrows them for short, focused interactions.

## Language

**R1 companion**:
The Rabbit R1 surface a single owner actively opens while away from the desk to inspect and intervene in existing Agent sessions on one Host. It is not a standalone coding agent, an agent launcher, or a full Paseo client.
_Avoid_: R1 agent, mini Paseo, mobile dashboard

**Host**:
A user-selected Paseo connection profile that points at one daemon. An R1 companion is paired with one Host in the MVP.
_Avoid_: Connection, server

**Relay offer**:
The existing Paseo trust bootstrap containing the Host identity and cryptographic material needed to establish an encrypted Relay connection. It is acceptable only for owned-device private dogfood because its authority is not read-only or R1-scoped.
_Avoid_: Device grant, account login

**Creation release**:
An immutable, versioned R1 web bundle published on an HTTPS static origin. A new version receives a new URL rather than replacing an installed release in place.
_Avoid_: Daemon UI, live deployment

**Tested firmware**:
The one RabbitOS build for which the complete hardware capability and release matrix has passed on the owned R1. Feature detection on another build does not imply product support.
_Avoid_: Compatible firmware, latest firmware

**Installation QR**:
The RabbitOS payload that installs one Creation release URL and its display metadata. It does not pair a Host or authorize Paseo access.
_Avoid_: Relay offer, pairing QR

**Device grant**:
An R1-specific authorization bound to exactly one Host and containing only the scopes supported and explicitly approved for the installed release. Its `read` scope covers current and future Workspaces on that Host, but never another Host. It may add Follow-up and later Stop only through a new approval in a trusted full Paseo client, and is revocable without affecting other clients. Client upgrades never expand it automatically.
_Avoid_: Relay offer, provider credential, API key

**Device enrollment**:
A one-time, five-minute bootstrap initiated in trusted Paseo that lets an unpaired R1 establish a commandless verification session and request a Device grant. It is not a Relay offer or an active authorization.
_Avoid_: Pairing link, login, Device grant

**Device session**:
A short-lived, automatically rotated connection authorization issued only after the Host revalidates the Device grant and its current scopes. Revoking the grant immediately invalidates every Device session derived from it.
_Avoid_: Device grant, Relay offer

**Command receipt**:
A minimal, payload-free secure-storage record for one unresolved Controlled command. It contains command identity, command kind, target identities, the target turn for Stop, state, and timestamps so process restart can reconcile before another command is allowed.
_Avoid_: Draft, queued command, transcript cache

**Project**:
A logical grouping of Workspaces that share a git remote or main project root.
_Avoid_: Repository, repo

**Workspace**:
One concrete working directory on one Paseo daemon, belonging to exactly one Project and owning Agent sessions.
_Avoid_: Folder, directory, checkout

**Agent session**:
One instance of an agent in a Workspace, with one provider, model, working context, lifecycle, and timeline.
_Avoid_: Task, job, run, agent process

**Subagent**:
An Agent session explicitly related to a parent Agent session and managed through Paseo. Its relationship home is the parent Agent, while a cross-Workspace Subagent is also discoverable through a separate Related Subagents group in its execution Workspace.
_Avoid_: Child agent, child session

**Native subagent**:
A provider-managed Subagent discovered by Paseo and exposed as read-only. Native describes ownership, while read-only describes its R1 capability.
_Avoid_: Provider child, child session

**Agent lifecycle**:
The literal execution state of one Agent session. It is distinct from Workspace status and from whether a user should pay attention.
_Avoid_: Workspace activity, attention

**Workspace status**:
The aggregate priority state of work within one Workspace. It summarizes Agent sessions but never replaces an individual Agent lifecycle.
_Avoid_: Workspace lifecycle

**Attention**:
A server-backed reason that an Agent session requires a user's review, such as a permission, error, or finished turn. Device-local read state is not Attention.
_Avoid_: Unread, workspace status

**Read state**:
The R1-local record of whether meaningful content has been viewed after a live synchronization. It may weaken presentation but never creates, reorders, or clears Attention while data is stale.
_Avoid_: Attention, unread attention

**Meaningful content**:
A validated, non-empty, identity-matched projection that explains the finished turn or error behind one Attention version. Tool noise or an unrelated latest event does not qualify.
_Avoid_: Latest event, raw log

**Permission request**:
A provider request that blocks or gates an Agent session until it is resolved or expires.
_Avoid_: Prompt, generic confirm

**Permission handoff**:
The read-only R1 surface that summarizes a Permission request and tells the user to continue manually in an already paired full Paseo client. It does not claim to open another device.
_Avoid_: Approval, Device decision

**Follow-up**:
A new instruction sent to an existing Agent session after explicit review in Composer.
_Avoid_: New task, reply

**Draft**:
One unsent Follow-up bound to a specific Host, Workspace, and Agent session. It is never overwritten, moved, or deleted without an explicit target-aware action, and is never a queued or pending command.
_Avoid_: Queue, pending message, offline command

**Snapshot cache**:
A minimized, bounded, time-limited local copy of identities, states, and short summaries used to orient the user before synchronization. It is always stale until reconciled and never contains a raw timeline or tool payload.
_Avoid_: Offline database, timeline archive

**Controlled command**:
A Follow-up or Stop submitted with a stable command identity that the daemon can deduplicate and query after reconnect. An unknown result is never retried blindly.
_Avoid_: Draft, fire-and-forget action

**TransportState**:
The connection lifecycle value `unpaired`, `offline`, `connecting`, `syncing`, or `online`. It does not encode freshness, authorization, or compatibility.
_Avoid_: Connection freshness, auth state

**Freshness**:
Whether the current projection is `stale`, `syncing`, or `live` after authoritative reconciliation.
_Avoid_: TransportState, Agent lifecycle

**AuthState**:
Whether the device is `unauthorized`, `active`, or `auth-required` for its bound Host.
_Avoid_: TransportState, Compatibility

**Compatibility**:
The independent client/protocol/firmware outcome `supported`, `limited`, `upgrade-required`, or `unsupported`.
_Avoid_: AuthState, TransportState

**Composer**:
The review surface where a Follow-up is inspected or edited before Send.
_Avoid_: Message input, voice mode

**Composer dictation**:
The hardware-first Follow-up input flow in which the user records, reviews the complete transcript, then chooses Send or Cancel. Touch editing is optional acceleration, not part of the core flow.
_Avoid_: Voice mode, voice chat

**Stop**:
Conditional cancellation of the exact turn the user reviewed and confirmed in one Agent session. Stop never affects a successor turn and does not close, archive, detach, or delete the Agent session, Workspace, or any Subagent.
_Avoid_: Close agent, terminate session, archive

## Flagged Ambiguities

**Agent**:
May appear as compact UI copy, but product documentation uses **Agent session** for the domain concept.

**Connection**:
Reserved for one transport path belonging to a Host; it is not a synonym for Host.

## Example Dialogue

> **Developer:** The Mobile app Workspace needs attention because its Release auth fix Agent session has a permission.
>
> **Product owner:** Open that Agent session. Its Subagent can still be running even if the parent lifecycle is idle.
>
> **Developer:** The provider also reported a Native subagent, so R1 will show its parent relationship and keep it read-only.
>
> **Product owner:** Good. Use Permission handoff for the blocked request, then send a Follow-up through Composer if more work is needed.
