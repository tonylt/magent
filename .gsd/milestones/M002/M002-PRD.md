# M002: Mobile Paseo Companion — UX-Differentiated MVP

**Status:** active (supersedes M001 as the near-term focus; M001 R1 line paused)
**Started:** 2026-07-20

## Direction Change (from M001)

M001 targeted a Rabbit R1 Creation client. Owned-device testing surfaced too much
platform friction (no on-device console, side-button long-press likely OS-reserved,
viewport quirks, cert/cache friction, discrete-only input). We pivot the near-term
MVP to a **mobile app** whose competitive edge is **UI/UX**, not new backend.

- M001 R1 line is **paused** (not deleted). Its reusable assets carry over: the
  domain model (`CONTEXT.md`), design language (`DESIGN.md`), safety principles
  (data minimization, read-only Permission handoff, STALE/LIVE freshness, queryable
  non-retried commands), and the pinned Relay contract work (S04).
- Backend: a connectable Paseo daemon / Relay offer is available. The MVP is built
  UX-first with mock data, then wired to the daemon.

## Product Thesis

Paseo's existing mobile client ports a desktop-scale tool onto a phone. Our
differentiator: **optimize for away-from-desk triage and intervention.**

- **Attention-first**: the home surface makes the highest-priority Agent session that
  needs review obvious at a glance (permission / error / finished turn), ranked.
- **Three-step core loop**: glance → open Agent → reply (Follow-up) or Stop, with the
  fewest taps.
- **Mobile ergonomics**: large touch targets, gesture navigation, voice dictation for
  Follow-up, one-hand reachability.
- **Trustworthy state**: freshness (`STALE`/`SYNCING`/`LIVE`) and safety
  (authorization, permission handoff) are always visible; stale data never looks live
  and never enables actions.

## Tech Stack

- **Expo + React Native + TypeScript** (chosen). Runs on iOS/Android via Expo Go and
  on web (react-native-web) for fast preview and design review.
- Navigation: `expo-router`.
- Data layer: a mockable repository interface. MVP ships deterministic mock Paseo
  data; a later increment wires the same interface to the daemon via the Relay
  contract (reusing S04).
- Lives under `mobile/` to stay isolated from the paused R1 code.

## MVP Scope (first release)

Screens (mock data, then wired):

1. **Attention Home** (flagship): ranked Attention list across Workspaces, each with
   reason (permission/error/finished), freshness, and the owning Agent; empty and
   overflow states; pull-to-refresh reconciliation.
2. **Workspace / Agent list**: Workspaces with aggregate status; Agent sessions with
   lifecycle, provider/model, and Subagent affordance.
3. **Agent timeline**: bounded, projected timeline; source stack; Native/read-only
   markers; freshness banner.
4. **Follow-up composer**: voice dictation → full transcript review → Send / Cancel;
   target-bound Draft; never auto-sends.
5. **Permission handoff**: read-only summary + "continue in Paseo"; no approve/deny.

Explicitly out of first-MVP scope: exact-turn Stop UI, multi-Host, Device
enrollment/scope management UI, team/shared device, offline persistence hardening.
These follow once the read + Follow-up loop is proven.

## Differentiation Acceptance (qualitative, MVP)

- From a cold open, the user identifies the top Attention item in one glance and
  reaches the relevant Agent in <= 2 taps.
- Freshness and authorization state are unambiguous on every screen.
- Follow-up requires explicit review before send; dictation is the primary input.
- The redesigned surfaces feel materially faster/clearer than a desktop-port layout
  (design review against the current Paseo mobile flows).

## Plan (slices)

- **M2-S01**: Expo/TS scaffold under `mobile/`, theme/design tokens, domain types,
  mock repository + Attention/freshness selectors, pure-logic unit tests.
- **M2-S02**: Attention Home (flagship).
- **M2-S03**: Workspace/Agent list + Agent timeline.
- **M2-S04**: Follow-up composer (dictation + review) + Permission handoff.
- **M2-S05**: Wire the repository to the real daemon via the Relay contract; freshness
  reconciliation on reconnect.
- **M2-S06**: Design-review pass vs current Paseo mobile; polish, a11y, one-hand.

## Voice dictation

- **Now (route A, shipped):** the Composer is a real multiline `TextInput`; on iOS the
  keyboard microphone provides native dictation (SFSpeechRecognizer) with no extra
  native module, so it works in Expo Go. Review-before-send, Draft bound to the Agent,
  and never-auto-send are preserved.
- **Long-term (route B):** a dedicated hold-to-talk recognizer via
  `expo-speech-recognition` (Apple Speech framework + Android SpeechRecognizer) with
  live partial transcripts. Requires a development build (not Expo Go) plus microphone
  and speech-recognition permissions. Tracked for when M002 moves to a dev/EAS build.

## Verification

- Pure domain/selectors: `node --test` (attention ranking, freshness, target-bound
  Draft rules).
- Types: `tsc --noEmit`.
- Runtime preview: `expo start` (Expo Go on device) and `expo start --web`.
- Design review of each screen against the thesis before wiring the daemon.

## M2-S05 Integration Findings (official Paseo, github.com/getpaseo/paseo)

Reuse the official SDK instead of re-implementing the protocol; our value is UX.

- **Pairing**: the pair URL is `https://app.paseo.sh/#offer=<base64url>`. Decode with
  `parseConnectionOfferFromUrl()` (`@getpaseo/protocol`) → `ConnectionOfferV2`:
  `{ v:2, serverId, daemonPublicKeyB64, relay:{ endpoint, useTls? } }`.
- **Connect (relay, E2EE)**: `new DaemonClient({ url: buildRelayWebSocketUrl({ endpoint,
  useTls, serverId }), e2ee:{ enabled:true, daemonPublicKeyB64 }, clientId,
  clientType:"mobile", appVersion })` then `await client.connect()`.
- **Read**: low-level client `@getpaseo/client/internal/daemon-client` exposes
  `fetchWorkspaces()`, `fetchAgents()`, `fetchAgentTimeline(agentId)`. Each agent
  snapshot carries `requiresAttention?`, `attentionReason?: finished|error|permission`,
  `attentionTimestamp?`. Attention Home = agents with `requiresAttention`, ranked by
  our existing selector. The high-level facade `createPaseoClient()` is handle/
  subscription-oriented (workspaces.list, agent/timeline handles) — good for live
  updates later.
- **Follow-up**: agent handle `.send(text)` (facade) / send RPC (low-level).
- **Versions**: installable npm `@getpaseo/client@0.1.110` (latest); repo source is the
  unreleased `0.2.0-beta.1`. Match the client to the running daemon version.
- **RN runtime**: relay E2EE needs a crypto/random polyfill and the global WebSocket
  (RN provides WebSocket; add `react-native-get-random-values` etc. mirroring
  `packages/app`). Final connect must be verified on-device against the daemon.

Plan: replace the provisional `src/data/paseo/{transport,pairUrl,client}.ts` seam with
a `DaemonClient`-backed `PaseoRepository`, add a Connect screen (paste/scan the offer
URL) + repository provider, and the crypto polyfill.
