---
milestone: M001
slice: S12
title: Immutable audited Creation release path
type: tdd
wave: 3
depends_on: [S03]
status: in_progress
autonomous: partial
requirements: [R006]
files_modified:
  - scripts/lib/release.mjs
  - scripts/package-release.mjs
  - scripts/verify-release.mjs
  - tests/unit/release.test.js
  - package.json
  - .github/workflows/pages.yml
  - .gsd/milestones/M001/S12-PLAN.md
  - .gsd/milestones/M001/S12-SUMMARY.md
---

# S12: Immutable Audited Creation Release Path

## Objective

Package the verified S03 production bundle into an immutable, versioned release at
`/r1/v<version>/` with an audit manifest (per-file digests plus an overall release
digest), a strict CSP, pinned dependencies, and cache-busted upgrade (a new version
is a new URL, never an in-place replace). The release installs reproducibly on the
owned R1 (the on-device confirmation is HITL).

## Consumes / Produces

- Consumes: S03 reproducible `dist/production` bundle and `build-meta.json` digests;
  the GitHub Pages hosting decision.
- Produces: `dist/r1/v<version>/` immutable output, `release.json` audit manifest,
  a release verifier, and a Pages publish of the versioned release. Feeds S13
  (enrollment binds to a specific immutable client identity/version).

## Approach (additive, non-destructive)

The existing `dist/production` pipeline and its S03 verifications are unchanged. A new
packaging step copies the verified output into the versioned immutable path and emits
the audit manifest, so S03 evidence stays intact.

## Tasks

1. `scripts/lib/release.mjs`: pure helpers — `computeReleaseDigest(files)`,
   `extractCspDirectives(html)`, `buildReleaseManifest(...)` — with unit tests.
2. `scripts/package-release.mjs`: copy `dist/production` -> `dist/r1/v<version>/` and
   write `release.json` (schema, version, immutable path, entry, per-file digests,
   overall release digest, CSP).
3. `scripts/verify-release.mjs`: re-verify the versioned release — files match the
   manifest, the release digest recomputes, CSP directives present, and no remote or
   dynamic-import references.
4. `npm run release` / `npm run verify:release` scripts.
5. Extend the Pages workflow to build, package, and publish the versioned release
   under `/r1/v<version>/` alongside the probe.

## Deferred (needs a decision or hardware)

- Vendored install QR for the production release (no runtime CDN). Decision: ship a
  build-time-generated static SVG from a small self-contained encoder, or add a
  pinned QR dependency. The demo `install.html` still uses a CDN and is out of the
  S01 budget graph; production must vendor it.
- HITL: reproducible fresh install and cache-busted upgrade confirmed on the owned R1.

## Verification

- `npm run test:probe` (release helper unit tests)
- `npm run release && npm run verify:release`
- `npm run verify` stays green (S03 pipeline unchanged)

## Acceptance Criteria (this increment)

- The versioned immutable release and audit manifest are produced deterministically.
- The release verifier fails closed on a digest mismatch, missing CSP directive, or a
  remote/dynamic-import reference.
- The default `dist/production` build, S03 output/source checks, and byte/DOM budgets
  are unchanged.
- Vendored QR and on-device reproducible-install confirmation remain open S12 items.
