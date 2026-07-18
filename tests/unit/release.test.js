import test from "node:test";
import assert from "node:assert/strict";

import { buildReleaseManifest, computeReleaseDigest, extractCspDirectives } from "../../scripts/lib/release.mjs";

const sha = (n) => String(n).repeat(64).slice(0, 64);
const files = [
  { name: "styles.css", bytes: 100, sha256: sha(2) },
  { name: "app.js", bytes: 200, sha256: sha(1) },
];

test("release digest is deterministic and order-independent", () => {
  const a = computeReleaseDigest(files);
  const b = computeReleaseDigest([...files].reverse());
  assert.equal(a, b);
  assert.match(a, /^[a-f0-9]{64}$/);
});

test("release digest changes when a file digest changes", () => {
  const before = computeReleaseDigest(files);
  const after = computeReleaseDigest([{ ...files[0], sha256: sha(9) }, files[1]]);
  assert.notEqual(before, after);
});

test("extracts CSP directives from an index.html meta tag", () => {
  const html = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'; style-src \'self\'">';
  assert.deepEqual(extractCspDirectives(html), ["default-src 'none'", "script-src 'self'", "style-src 'self'"]);
  assert.deepEqual(extractCspDirectives("<html></html>"), []);
});

test("builds an immutable manifest with a versioned path and sorted files", () => {
  const manifest = buildReleaseManifest({
    version: "0.1.0",
    entry: "app.js",
    files,
    html: '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'">',
  });
  assert.equal(manifest.schema, 1);
  assert.equal(manifest.version, "0.1.0");
  assert.equal(manifest.path, "/r1/v0.1.0/");
  assert.equal(manifest.entry, "app.js");
  assert.match(manifest.releaseDigest, /^[a-f0-9]{64}$/);
  assert.deepEqual(manifest.files.map((f) => f.name), ["app.js", "styles.css"]);
  assert.deepEqual(manifest.csp, ["default-src 'none'"]);
});

test("rejects a non-semver version or malformed file digest", () => {
  assert.throws(() => buildReleaseManifest({ version: "v1", entry: "app.js", files, html: "" }), /semver/);
  assert.throws(() => buildReleaseManifest({ version: "0.1.0", entry: "app.js", files: [{ name: "x", sha256: "nope" }], html: "" }), /invalid file/);
  assert.throws(() => buildReleaseManifest({ version: "0.1.0", entry: "app.js", files: [], html: "" }), /non-empty/);
});
