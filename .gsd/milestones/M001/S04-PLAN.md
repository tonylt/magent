---
milestone: M001
slice: S04
title: Pinned Relay E2EE compatibility tracer
type: tdd
wave: 2
depends_on: [S03]
status: in_progress
autonomous: true
requirements: [R002]
files_modified:
  - src/production/relay
  - tests/unit/production
  - .gsd/milestones/M001/S04-PLAN.md
  - .gsd/milestones/M001/S04-SUMMARY.md
---

# S04: Pinned Relay E2EE Compatibility Tracer

## Objective

Pin the exact Paseo Relay message subset the R1 companion depends on — WebSocket
`hello`, imported Relay offer, agent `subscription`, and E2EE `frame` — into a
deterministic contract, a pinned client adapter, and fixtures. When any observed
message drifts from the pinned contract, the adapter must fail **visibly** with a
stable `Compatibility` verdict and a payload-free failure label instead of
silently proceeding to sensitive data.

This slice retires part of the "Relay compatibility" risk at the contract level.
It does **not** open a real network, does not import a real Relay offer, and does
not display Paseo product data — those remain S05 (real-R1 private bootstrap) and
are gated behind owned-hardware evidence.

## Proposed Boundaries

- `src/production/relay/protocol.ts`: pinned protocol constants
  (`PROTOCOL_VERSION`, `MIN_RELAY_PROTOCOL`, `CLIENT_VERSION`), the pinned message
  types for `hello`/`hello-ack`/`offer`/`subscribe`/`subscribe-ack`/`frame`, and
  pure validators that return discriminated `ok`/`fail` results with a stable
  reason label. No DOM, no network, no crypto secrets.
- `src/production/relay/transport.ts`: a minimal `RelayTransport` interface
  (`send`, `receive` subscription, `close`) that isolates the unstable socket SDK,
  plus a deterministic scripted fake transport for fixtures and tests.
- `src/production/relay/relay-client.ts`: `createPinnedRelayClient` that drives the
  handshake through the transport, validates every inbound message against the
  pinned contract, and produces a `CompatibilityReport`
  (`supported`/`limited`/`upgrade-required`/`unsupported`) with the handshake
  `stage` and an optional stable `failure` label.
- `src/production/relay/fixtures.ts`: valid and drifted fixtures for each message
  plus scripted relay endpoints (well-behaved, protocol-too-old, min-client-not-met,
  malformed offer, insecure endpoint, rejected subscription, malformed/out-of-order
  frame) used by both tests and future S05 wiring.

## Pinned Contract (subset)

1. Client `hello`: `{ t:"hello", protocol, minRelay, client:{name,version}, capabilities[] }`.
2. Relay `hello-ack`: `{ t:"hello-ack", protocol, minClient, relay:{id} }`. The
   client verifies `protocol >= MIN_RELAY_PROTOCOL` and `CLIENT_VERSION >= minClient`.
3. Relay offer (imported credential, parsed not received): `{ v, host:{id}, relay:{endpoint}, publicKey }`.
   `endpoint` must be `wss://`; `publicKey` must be present and non-empty.
4. `subscribe` request `{ t:"subscribe", topics[] }` and `subscribe-ack`
   `{ t:"subscribe-ack", topics[] }`; acked topics must cover the requested set.
5. E2EE `frame` envelope `{ t:"frame", seq, nonce, ciphertext, tag }`; required
   fields present, bounded size, `seq` strictly increasing with no gap. The tracer
   validates framing only — it never decrypts and never records ciphertext.

## Visible Failure Range

Each mismatch maps to a stable, payload-free verdict:

- Protocol older than pinned minimum -> `upgrade-required` / `RELAY PROTOCOL TOO OLD`.
- Client older than relay `minClient` -> `upgrade-required` / `CLIENT UPGRADE REQUIRED`.
- Malformed `hello-ack` -> `unsupported` / `MALFORMED HELLO ACK`.
- Malformed offer or non-`wss` endpoint or missing key -> `unsupported` / `MALFORMED OFFER` | `INSECURE RELAY ENDPOINT` | `MISSING RELAY KEY`.
- Subscription not acked / partially acked -> `unsupported` / `SUBSCRIPTION REJECTED`.
- Malformed frame or sequence gap -> `unsupported` / `MALFORMED FRAME` | `FRAME SEQUENCE GAP`.
- Transport closed mid-handshake -> `unsupported` / `TRANSPORT CLOSED`.
- All stages clean -> `supported`.

## Tasks

1. Write RED unit tests for the pure validators (each valid + each drifted fixture)
   and for the client tracer (each scripted endpoint yields the expected verdict,
   stage, and failure label), asserting reports are payload-free.
2. Implement `protocol.ts` validators and pinned constants.
3. Implement `transport.ts` interface and scripted fake transport.
4. Implement `relay-client.ts` tracer that walks hello -> offer -> subscribe -> frame
   and returns the first visible failure or `supported`.
5. Implement `fixtures.ts` with valid and drifted messages and scripted endpoints.
6. Keep the module out of the default `main.ts` bundle so S03 output/budgets and the
   fail-closed default are unchanged; wiring to a live transport and UI is S05.

## Verification

- `npm run typecheck`
- `npm run test:production`
- `npm run verify` (unit, budgets, source/output boundary, browser)
- Source-boundary scan confirms no RabbitOS private globals in the relay module.

## Acceptance Criteria

- The pinned contract and validators exist as pure, DOM-free TypeScript.
- Each drifted fixture produces the expected visible `Compatibility` verdict and
  stable failure label; a clean endpoint produces `supported`.
- The tracer never records ciphertext, keys, offer material, or topic payloads —
  only identity/result metadata.
- The default production bundle, output allowlist, and byte/DOM budgets are unchanged.
- No real network, no imported real Relay offer, and no Paseo product data — S05 and
  S02 hardware evidence remain separate and are not substituted.
