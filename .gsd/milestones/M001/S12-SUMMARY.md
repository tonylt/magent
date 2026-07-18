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
key-files:
  created:
    - scripts/lib/release.mjs
    - scripts/package-release.mjs
    - scripts/verify-release.mjs
    - tests/unit/release.test.js
    - .gsd/milestones/M001/S12-PLAN.md
  modified:
    - package.json
    - .github/workflows/pages.yml
---

# S12 Summary (increment 1): Immutable Audited Release Backbone

## Outcome

The verified S03 production bundle can now be packaged into an immutable, versioned
release without touching the existing `dist/production` pipeline. `npm run release`
copies the shipped assets to `dist/r1/v<version>/` and writes a deterministic
`release.json` audit manifest: schema, version, immutable path `/r1/v<version>/`,
entry, per-file `sha256`/bytes, an overall `releaseDigest`, and the extracted CSP
directives. `npm run verify:release` re-verifies the release independently — per-file
digests, directory-vs-manifest match, digest recomputation, required strict-CSP
directives, and no remote or dynamic-import references — and fails closed otherwise.

A new immutable version is a new path, so upgrades are cache-busted by construction
and a published version is never replaced in place (ADR 0005).

## Verification Evidence

- `npm run test:probe`: 32 tests pass, including 5 new pure release-manifest cases
  (deterministic order-independent digest, digest sensitivity, CSP extraction with
  inner single quotes, versioned-path manifest, semver/digest validation).
- `npm run verify:release`: packaged and verified `/r1/v0.1.0/` (4 shipped files +
  `release.json`, digest `80f0c3859fee…`).
- The release verifier caught a real defect during development (build-meta.json copied
  but not a shipped asset); fixed by copying exactly the manifest's declared files.
- S03 pipeline unchanged: `dist/production`, `verify:production-source/output`, and
  byte/DOM budgets are untouched (the release step is additive and reads the verified
  output).

## Deferred S12 Items (not complete)

- **Pages publish of the versioned release**: the workflow currently publishes only
  the probe (`demo/`); publishing `dist/r1/v<version>/` under the site is a follow-up
  that must not disturb the probe path. Locally, `RELEASE_BASE_URL=<origin> npm run
  release` produces a scannable install page.
- **HITL**: reproducible fresh install and cache-busted upgrade confirmed on the
  owned R1.

## Increment 2: Vendored install QR (complete)

The production install page is now vendored — no runtime CDN. `qrcode-generator@1.4.4`
(pinned exact, zero dependencies) generates an inline SVG QR of the RabbitOS install
payload at build time, so the install page is script-free and keeps a strict CSP
(`default-src 'none'`). `package-release.mjs` writes `install.html` into the version
directory, encoding `${RELEASE_BASE_URL}/r1/v<version>/`. `verify-release.mjs` treats
`install.html`/`release.json` as release-level extras and checks the install page is
script-free, references no external resources, carries a strict CSP, and contains the
inline SVG (the SVG namespace and the release URL are content, not fetched resources,
so a reference-based scan is used).

New unit tests: 5 install-page cases (payload https/semver validation, strict-CSP
script-free render, no external references, rejects non-SVG/scripted markup). Probe
suite is 37 tests.

## Deviations

- Implemented additively (a separate packaging step over the verified output) instead
  of changing the S03 build to emit the versioned path directly, to preserve S03
  evidence and avoid destabilizing the verified pipeline. No product-scope or
  roadmap-direction change.

## Self-Check

Increment 1 (immutable versioned release + audit manifest + verifier + tests) is
complete and verified. S12 as a whole remains `in_progress`: vendored QR, Pages
publish of the release, and on-device reproducible-install confirmation are open.
