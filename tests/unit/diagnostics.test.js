import test from "node:test";
import assert from "node:assert/strict";

import { createDiagnosticLog } from "../../demo/lib/diagnostics.js";

test("diagnostics accepts only allowlisted event types and fields", () => {
  const log = createDiagnosticLog({ capacity: 4, now: () => 1234 });
  assert.equal(log.record("input", {
    command: "next",
    source: "rabbit",
    result: "emitted",
    transcript: "secret transcript",
    token: "secret token",
    payload: { raw: true },
  }), true);
  assert.equal(log.record("arbitrary", { message: "must not appear" }), false);
  const serialized = JSON.stringify(log.snapshot());
  assert.match(serialized, /next/);
  assert.doesNotMatch(serialized, /secret|transcript|token|payload|must not appear/);
});

test("diagnostics is bounded by entry count and serialized byte budget", () => {
  let at = 0;
  const log = createDiagnosticLog({ capacity: 3, maxBytes: 220, now: () => ++at });
  for (let index = 0; index < 12; index += 1) {
    log.record("navigation", { view: "diagnostics", focus: index });
  }
  const entries = log.snapshot();
  assert.ok(entries.length <= 3);
  assert.ok(new TextEncoder().encode(JSON.stringify(entries)).byteLength <= 220);
  assert.equal(entries.at(-1).focus, 11);
});

test("error diagnostics never persist messages, URLs, or free-form reasons", () => {
  const log = createDiagnosticLog({ now: () => 99 });
  log.record("error", {
    kind: "runtime",
    code: "unhandled",
    message: "https://example.test/?token=secret prompt text",
    reason: "provider credential",
  });
  assert.deepEqual(log.snapshot(), [{ at: 99, type: "error", kind: "runtime", code: "unhandled" }]);
});
