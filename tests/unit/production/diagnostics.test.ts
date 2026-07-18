import test from "node:test";
import assert from "node:assert/strict";

import { createBoundedDiagnostics } from "../../../src/production/diagnostics.ts";

test("production diagnostics retain only bounded allowlisted codes", () => {
  const diagnostics = createBoundedDiagnostics({ maxEntries: 4, maxBytes: 220 });
  for (let index = 0; index < 20; index += 1) {
    diagnostics.record("command-rejected", index % 2 === 0 ? "background" : "not-ready");
  }

  const snapshot = diagnostics.snapshot();
  assert.ok(snapshot.length <= 4);
  assert.ok(Buffer.byteLength(JSON.stringify(snapshot), "utf8") <= 220);
  assert.deepEqual(new Set(snapshot.map((entry) => entry.type)), new Set(["command-rejected"]));
  assert.equal(JSON.stringify(snapshot).includes("transcript"), false);
});
