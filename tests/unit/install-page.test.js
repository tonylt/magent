import test from "node:test";
import assert from "node:assert/strict";

import { buildInstallPayload, renderInstallHtml } from "../../scripts/lib/install-page.mjs";

const appUrl = "https://user.github.io/repo/r1/v0.1.0/";
const qrSvg = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"><path d="M0,0"/></svg>';

test("install payload carries the https release url", () => {
  const payload = buildInstallPayload({ version: "0.1.0", appUrl });
  assert.equal(payload.url, appUrl);
  assert.equal(payload.title, "Paseo R1 v0.1.0");
});

test("install payload rejects a non-https url or bad version", () => {
  assert.throws(() => buildInstallPayload({ version: "0.1.0", appUrl: "http://insecure/" }), /https/);
  assert.throws(() => buildInstallPayload({ version: "v1", appUrl }), /semver/);
});

test("install html has a strict CSP, inline SVG, and no scripts", () => {
  const html = renderInstallHtml({ version: "0.1.0", appUrl, qrSvg });
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /default-src 'none'/);
  assert.equal(/unsafe-inline|unsafe-eval/.test(html), false);
  assert.equal(/<script\b/i.test(html), false);
  assert.ok(html.includes("<svg"));
  assert.ok(html.includes(appUrl));
});

test("install html has no external resource references", () => {
  const html = renderInstallHtml({ version: "0.1.0", appUrl, qrSvg });
  assert.equal(/(?:src|href)\s*=\s*["']https?:/i.test(html), false);
});

test("install html rejects markup that is not inline svg or contains a script", () => {
  assert.throws(() => renderInstallHtml({ version: "0.1.0", appUrl, qrSvg: "not svg" }), /inline SVG/);
  assert.throws(() => renderInstallHtml({ version: "0.1.0", appUrl, qrSvg: "<svg><script>x</script></svg>" }), /script/);
});
