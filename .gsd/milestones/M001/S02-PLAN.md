---
milestone: M001
slice: S02
title: Firmware-bound owned-R1 capability matrix
type: hitl
wave: 2
depends_on: [S01]
status: awaiting_hardware
autonomous: false
requirements: [R001, R008, R012]
files_modified:
  - demo
  - artifacts/hardware/s02
  - .gsd/milestones/M001/S02-HARDWARE-UAT.md
---

# S02: Firmware-Bound Owned-R1 Capability Matrix

## Objective

Produce one auditable capability decision for one owned Rabbit R1 firmware. Every result is tied to the same firmware, immutable probe version, installation URL digest, timestamp, and evidence identifier. Browser mocks and presence checks are preparation only and never produce a hardware `PASS`.

## Safety Boundary

- Complete firmware and security-capability checks before importing a Relay offer, reading a Device grant, or requesting Paseo data.
- Use only local/LAN or user-controlled trusted HTTPS hosting. Do not expose a daemon or probe through a public temporary tunnel without explicit approval.
- Evidence and diagnostics contain no token, credential, Relay offer, prompt, transcript, raw audio, URL query, device identity, or third-party payload.
- Unknown firmware is not supported. Missing E2EE, identity, or data-integrity capability is `BLOCKER/UNSUPPORTED`.
- Missing secure storage permits future session-only read behavior, but blocks Follow-up and Stop.
- An unverifiable or unreliable device lock keeps the project private read-only and blocks distributable Phase 2A.

## Tasks

1. Extend the S01 probe with explicit test controls and sanitized evidence export for firmware metadata, viewport, hardware events, STT, secure storage, HTTPS/WSS, lifecycle, and resource observations.
2. Produce a versioned probe artifact and install it fresh on the owned R1 through a trusted HTTPS origin.
3. Execute every test in `S02-HARDWARE-UAT.md` on the same firmware and probe version, attaching evidence IDs rather than sensitive raw logs.
4. Classify every capability as `PASS`, `FALLBACK`, or `BLOCKER`, and derive the allowed product mode: private read-only, distributable session-only read, distributable secure read, or Controlled-Action eligible.
5. Record measured wheel mapping, late-click suppression, too-short threshold, recording cap behavior, retry/lifecycle behavior, and resource baselines as configuration inputs for later slices.

## Automated Preparation

- Unit tests cover event ordering, duplicate edges, delayed release after cap, background input rejection, STT single-flight, storage model corruption/wipe, and sanitized evidence serialization.
- Browser tests cover all probe states at 240x282, CJK wrapping fixtures, no overflow, bounded DOM/log/timers, and no remote requests outside the configured trusted test endpoint.
- Automated preparation may mark a UAT item `READY`, never `PASS`.

## HITL Exit Gate

S02 is complete only when:

- every UAT item has a result and evidence ID;
- all results refer to one exact firmware and one immutable probe digest;
- security-critical items have no unresolved `FALLBACK`;
- product mode and downstream blockers are explicitly recorded;
- the owner signs the matrix;
- `S02-SUMMARY.md` distinguishes measured facts from interpretations.

## Verification

- `npm run verify`
- Fresh QR install from the recorded immutable HTTPS URL
- Cache-busted upgrade from the preceding probe version
- `S02-HARDWARE-UAT.md` completed and signed
- Evidence files reviewed for sensitive data before commit

## Current Status

The automated S01 harness is complete. No owned-R1 result has been collected in this execution, so S02 remains `awaiting_hardware`.
