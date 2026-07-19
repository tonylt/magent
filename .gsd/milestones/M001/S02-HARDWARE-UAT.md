---
status: pending
milestone: M001
slice: S02
started: 2026-07-18
updated: 2026-07-18
tested_firmware: pending
probe_version: pending
probe_digest: pending
trusted_origin: pending
owner_signoff: pending
---

# S02 Owned-R1 Hardware UAT

## Evidence Rules

- Store evidence under `artifacts/hardware/s02/` using IDs such as `S02-E001`.
- Screenshots, recordings, and event exports must be reviewed and redacted before commit.
- Record origin class and release digest, not URL query strings, host credentials, Device IDs, network addresses, or Relay offers.
- Each result is exactly `PASS`, `FALLBACK`, `BLOCKER`, or `PENDING`.
- Re-run the entire matrix when firmware support changes.

## Evidence Capture (probe harness)

The probe ships a sanitized, bounded, payload-free evidence collector
(`demo/lib/evidence.js`). It is allowlist-validated, so the export can only hold
structured capability/result metadata — never a token, transcript, raw audio, URL,
credential, Device ID, network address, or Relay offer.

On-device recorder (no console required): from Home, wheel to **UAT recorder** and
side-click to open it. The wheel moves between H01–H24, each side-click cycles the
focused item `PENDING → PASS → FALLBACK → BLOCKER`, and the header shows the live
viewport, voice-bridge, and secure-storage state plus the evidence ID. Screenshot the
list and the CAPABILITIES/TRANSPORT screens as the redacted evidence artifacts. Each
recorded result is mirrored into the evidence collector under `S02-E0<index>`.

Where a JS console is available (`chrome://inspect`), the same hook is on `window`:

```js
__probeEvidence.setFirmware("tested");                 // human decision on device
__probeEvidence.recordResult({ id: "H05", result: "PASS", evidenceId: "S02-E001" });
__probeEvidence.recordMeasurement("lateClickSuppressionMs", 420);
__probeEvidence.recordResourceSample({ elapsedMinutes: 30, domNodes: 118, timers: 3 });
__probeEvidence.setProductMode("PRIVATE_READ_ONLY");
const bundle = __probeEvidence.export();               // review, then save under artifacts/hardware/s02/
```

`originClass` is derived from the location without storing the URL. Set
`<meta name="probe-digest" content="...">` to bind the exported bundle to a release
digest. Human notes stay in this matrix; only machine-checkable evidence lives in the
export.

## Matrix

| ID | Area | Expected evidence | Result | Evidence ID | Notes |
|---|---|---|---|---|---|
| H01 | Fresh install | QR installs immutable probe; exact firmware, viewport, version, digest, origin class recorded | PENDING | - | Installs and runs from GitHub Pages trusted origin (owner-observed 2026-07-19); capture export/screenshot for evidence ID and record firmware/version/digest |
| H02 | Cache-busted upgrade | New immutable version loads after reinstall; old version remains immutable | PENDING | - | |
| H03 | Portrait canvas | Exact 240x292 CSS viewport, no document/app overflow, full return path | PENDING | - | Owner-observed viewport 240x292; retargeted the fixed canvas 282->292 across app/tests/screenshots. Reinstall (?v=7) and confirm no overflow and full return path on device |
| H04 | Landscape gate | No product data/action appears; portrait resumes prior state/focus | PENDING | - | |
| H05 | Wheel mapping | Physical direction, event names, rate, rapid ticks, boundaries, feedback latency measured | PENDING | - | Owner-observed: highlight moved opposite to the wheel and was over-sensitive. Applied device calibration (invert scrollUp/scrollDown + 80ms throttle) on Rabbit host; reinstall ?v=8 and re-confirm direction and feel |
| H06 | Side short click | One deliberate click produces exactly one semantic activation | PASS | S02-E006 | Owner-observed: a single side-click selects exactly once |
| H07 | Hold/release | Start/end ordering, duplicate/missing edges, held click, delayed release, late-click window measured | PENDING | - | Owner-observed: long-press produced no response. Added candidate hold-event mappings and an on-screen LAST EVT monitor (CAPABILITIES view). Hold the side button there and report the event name — none means side-button PTT does not reach the WebView (likely OS-reserved), a BLOCKER needing a touch fallback for dictation |
| H08 | Voice limits | Too-short threshold, 30-second cap, lost result, background interruption, reentry behavior measured | PENDING | - | |
| H09 | Native STT success | Native bridge starts/stops and returns one correlated non-empty result without auto-send | PENDING | - | Do not store transcript. VOICE BRIDGE FOUND (owner-observed); confirm hold->speak->transcript on device |
| H10 | Native STT failure | Empty/malformed/late/failed result is visible and recoverable; old result cannot bind a new request | PENDING | - | |
| H11 | CJK rendering | Representative user-owned CJK content has correct glyphs, wrapping, ellipsis, and no clipping | PENDING | - | Use non-sensitive fixture |
| H12 | OSK behavior | Focus, available height, CJK input, dismiss/resume recorded; keyboard remains optional for core path | PENDING | - | |
| H13 | Secure storage presence | Capability is checked before data; no fallback to localStorage | PENDING | - | SECURE STORE FOUND (owner-observed) — presence confirmed; R/W (H14) and restart (H15) still to verify |
| H14 | Secure storage R/W | Base64 test record writes, reads, overwrites, and deletes correctly within declared cap | PENDING | - | Synthetic test data only |
| H15 | Secure storage restart | Record survives full Creation/device restart exactly when contract claims persistence | PENDING | - | |
| H16 | Storage suspend/TTL | Suspend/resume, expiry, capacity boundary, and no stale secure result are measured | PENDING | - | |
| H17 | Storage corruption/wipe | Invalid schema/corruption fails closed and synthetic data is wiped on reset/invalidation | PENDING | - | |
| H18 | Device lock | Reliable RabbitOS lock exists, can be enabled, gates access after wake, and is documented for this firmware | PENDING | - | No daemon attestation claim |
| H19 | HTTPS | Trusted origin loads with normal certificate validation; failure is visible | PENDING | - | GitHub Pages trusted origin loads/installs/runs (owner-observed 2026-07-19); LAN self-signed cert rejected (black screen). Capture screenshot for evidence ID |
| H20 | WSS | Trusted test endpoint connects with certificate validation; offline/failure/recovery visible | PENDING | - | Not Relay/E2EE proof |
| H21 | Offline/online | Network transitions are observed without unbounded retries or false success | PENDING | - | |
| H22 | Suspend/resume | Active hold interrupts; background inputs are ignored; foreground restores inputs and exact safe state | PENDING | - | |
| H23 | Resource baseline | Bundle/frame observations, DOM/timers, battery indication, and memory behavior sampled for 30 minutes | PENDING | - | No raw payload |
| H24 | Diagnostics privacy | Export remains within 64 entries/16KiB and contains no prohibited data after all scenarios | PENDING | - | |

## Derived Product Mode

- Selected mode: `PENDING`
- Allowed values: `PRIVATE_READ_ONLY`, `DISTRIBUTABLE_SESSION_READ`, `DISTRIBUTABLE_SECURE_READ`, `CONTROLLED_ACTION_ELIGIBLE`, `UNSUPPORTED`
- Blocking capability IDs: `PENDING`
- Fallback capability IDs: `PENDING`
- Measured late-click suppression: `PENDING`
- Measured too-short threshold: `PENDING`
- Supported firmware statement: `PENDING`

## Owner Signoff

- Matrix reviewed on device: `PENDING`
- Evidence redaction reviewed: `PENDING`
- Result approved: `PENDING`

## Summary

- Total: 24
- Passed: 0
- Fallback: 0
- Blocked: 0
- Pending: 24
