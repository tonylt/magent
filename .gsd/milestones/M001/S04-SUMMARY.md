---
milestone: M001
slice: S04
title: Pinned Relay E2EE compatibility tracer
type: tdd
wave: 2
depends_on: [S03]
status: complete
completed: 2026-07-18
autonomous: true
requirements: [R002]
key-files:
  created:
    - src/production/relay/protocol.ts
    - src/production/relay/transport.ts
    - src/production/relay/relay-client.ts
    - src/production/relay/fixtures.ts
    - tests/unit/production/relay-protocol.test.ts
    - tests/unit/production/relay-client.test.ts
    - .gsd/milestones/M001/S04-PLAN.md
---

# S04 Summary: Pinned Relay E2EE Compatibility Tracer

## Outcome

The Paseo Relay message subset the R1 companion depends on is now pinned into a
pure, DOM-free contract with executable fixtures. `protocol.ts` fixes the
`hello`/`hello-ack`/`offer`/`subscribe`/`subscribe-ack`/`frame` shapes and the
pinned versions (`PROTOCOL_VERSION`/`MIN_RELAY_PROTOCOL`/`CLIENT_VERSION` = 3),
and exposes pure validators that return a discriminated `ok`/`fail` result with a
`Compatibility` verdict and a stable failure label.

`transport.ts` introduces a `RelayTransport` boundary that isolates the unstable
socket SDK, plus a deterministic scripted transport and an inbox helper so the
async tracer runs without real sockets or fake timers. `relay-client.ts`'s
`traceRelayCompatibility` walks the handshake and returns a `CompatibilityReport`
with the handshake `stage`, an optional payload-free `failure`, and identity/result
metadata only (`hostId`, `relayId`, requested `topics`, `framesValidated`).

`fixtures.ts` provides valid and drifted messages and eight scripted endpoints
(well-behaved, protocol-too-old, min-client-not-met, malformed hello-ack, rejected
subscription, malformed frame, frame sequence gap, transport closed mid-handshake).
On any drift the tracer stops at the first failure and never proceeds to sensitive
data. A clean endpoint traces as `supported`.

## Verification Evidence

- `npm run typecheck`: passed with strict TypeScript options.
- `npm run test:production`: 38 production tests passed, including 12 new protocol
  validator cases and 10 new tracer cases.
- The payload-free test traces every scripted endpoint and asserts the serialized
  report never contains the `PUBLICKEY`/`NONCE`/`CIPHERTEXT`/`TAG` sentinels.
- `npm run verify:production-source`: 10 bundle inputs — the relay module is
  correctly **not** in the default bundle; no RabbitOS private identifiers.
- `npm run verify:production-output`: 15,706 / 131,072 bytes, 0 remote dependencies
  — unchanged from S03, confirming the tracer does not affect the shipped artifact.
- Full `npm run verify`: unit (fail 0), S01 budgets, source/output boundary, and 10
  browser scenarios all passed end to end.

## Compatibility Verdict Map

| Drift | Compatibility | Stage | Failure label |
| --- | --- | --- | --- |
| Relay protocol below pinned minimum | `upgrade-required` | hello | `RELAY PROTOCOL TOO OLD` |
| Relay demands a newer client | `upgrade-required` | hello | `CLIENT UPGRADE REQUIRED` |
| Malformed hello-ack | `unsupported` | hello | `MALFORMED HELLO ACK` |
| Malformed offer | `unsupported` | offer | `MALFORMED OFFER` |
| Non-`wss` relay endpoint | `unsupported` | offer | `INSECURE RELAY ENDPOINT` |
| Offer missing public key | `unsupported` | offer | `MISSING RELAY KEY` |
| Subscription not fully acked | `unsupported` | subscribe | `SUBSCRIPTION REJECTED` |
| Malformed frame envelope | `unsupported` | frame | `MALFORMED FRAME` |
| Non-sequential frame | `unsupported` | frame | `FRAME SEQUENCE GAP` |
| Transport closed mid-handshake | `unsupported` | (current) | `TRANSPORT CLOSED` |
| All stages clean | `supported` | complete | — |

## Deliberate Limits

- This is a contract-level tracer against fixtures. It opens no real network, imports
  no real Relay offer, and displays no Paseo product data. Establishing a real
  WSS/E2EE transport and rendering a live Workspace/Attention/Agent timeline is S05
  and requires owned-R1 hardware evidence (S02), which this slice does not substitute.
- The tracer validates the E2EE frame **envelope** only; it never decrypts and never
  records ciphertext, nonces, tags, keys, or offer material. Decryption belongs to
  the real transport in S05.
- The pinned versions and topic set are current assumptions to be reconciled against
  the real daemon during S05/S11; the point of pinning is that any drift now fails
  visibly rather than silently.
- The module is intentionally not wired into `main.ts`, so the S03 fail-closed
  default and the byte/DOM budgets are unchanged.

## Deviations

- Handshake ordering was implemented as `offer -> hello -> subscribe -> frame`
  instead of the plan's `hello -> offer` wording. Validating the imported offer
  first is strictly fail-closed: a malformed or insecure offer is rejected before any
  `hello` is sent (asserted by `transport.sent.length === 0`). The pinned subset is
  identical; only the check order changed. No product-scope or roadmap-direction
  change was made.
- `REQUESTED_TOPICS` (`directory`, `attention`) and `FRAMES_TO_TRACE` (2) are
  deterministic tracer defaults, not measured daemon facts.

## Self-Check: PASSED

All S04 tasks and acceptance criteria have current automated evidence. S05 real
Relay transport and S02 hardware evidence remain explicitly separate and unmet.
