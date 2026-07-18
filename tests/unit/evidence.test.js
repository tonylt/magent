import test from "node:test";
import assert from "node:assert/strict";

import { createEvidenceCollector, deriveOriginClass } from "../../demo/lib/evidence.js";

test("derives origin class without storing the URL", () => {
  assert.equal(deriveOriginClass({ protocol: "https:", hostname: "127.0.0.1" }), "loopback");
  assert.equal(deriveOriginClass({ protocol: "https:", hostname: "192.168.1.23" }), "lan");
  assert.equal(deriveOriginClass({ protocol: "https:", hostname: "r1.local" }), "lan");
  assert.equal(deriveOriginClass({ protocol: "https:", hostname: "paseo.example.com" }), "trusted-https");
  assert.equal(deriveOriginClass({ protocol: "http:", hostname: "example.com" }), "insecure");
  assert.equal(deriveOriginClass({ protocol: "file:", hostname: "" }), "file");
});

test("rejects an invalid probe version or digest", () => {
  assert.throws(() => createEvidenceCollector({ version: "bad version!" }), TypeError);
  assert.throws(() => createEvidenceCollector({ version: "s02", digest: "NOTHEX" }), TypeError);
  assert.throws(() => createEvidenceCollector({ version: "s02", originClass: "public" }), TypeError);
});

test("captures environment and a matrix result with an evidence id", () => {
  const evidence = createEvidenceCollector({ version: "s02-1", digest: "abc123", originClass: "lan" });
  assert.equal(evidence.setFirmware("tested"), true);
  assert.equal(evidence.setViewport({ width: 240, height: 282, orientation: "portrait" }), true);
  assert.equal(evidence.setCapabilities({ https: true, secureStorage: false }), true);
  assert.equal(evidence.recordResult({ id: "H05", result: "PASS", evidenceId: "S02-E001" }), true);

  const bundle = evidence.export();
  assert.equal(bundle.schema, 2);
  assert.deepEqual(bundle.probe, { version: "s02-1", digest: "abc123", originClass: "lan" });
  assert.equal(bundle.environment.firmwareStatus, "tested");
  assert.deepEqual(bundle.environment.viewport, { width: 240, height: 282, orientation: "portrait" });
  assert.deepEqual(bundle.results, [{ id: "H05", result: "PASS", evidenceId: "S02-E001" }]);
});

test("refuses unknown matrix ids, results, and malformed evidence ids", () => {
  const evidence = createEvidenceCollector({ version: "s02" });
  assert.equal(evidence.recordResult({ id: "H99", result: "PASS", evidenceId: "S02-E001" }), false);
  assert.equal(evidence.recordResult({ id: "H05", result: "OK", evidenceId: "S02-E001" }), false);
  assert.equal(evidence.recordResult({ id: "H05", result: "PASS", evidenceId: "E1" }), false);
  assert.equal(evidence.export().results.length, 0);
});

test("keeps only the last result per matrix id", () => {
  const evidence = createEvidenceCollector({ version: "s02" });
  evidence.recordResult({ id: "H13", result: "PENDING", evidenceId: "S02-E010" });
  evidence.recordResult({ id: "H13", result: "BLOCKER", evidenceId: "S02-E011" });
  const results = evidence.export().results;
  assert.equal(results.length, 1);
  assert.deepEqual(results[0], { id: "H13", result: "BLOCKER", evidenceId: "S02-E011" });
});

test("only allowlisted measurements and resource fields are stored", () => {
  const evidence = createEvidenceCollector({ version: "s02" });
  assert.equal(evidence.recordMeasurement("lateClickSuppressionMs", 420), true);
  assert.equal(evidence.recordMeasurement("wheelDirection", "up-forward"), true);
  assert.equal(evidence.recordMeasurement("secretToken", "leak"), false);
  assert.equal(evidence.recordMeasurement("lateClickSuppressionMs", -5), false);
  assert.equal(evidence.recordResourceSample({ domNodes: 118, timers: 3, leaked: "x" }), true);

  const bundle = evidence.export();
  assert.deepEqual(bundle.measurements, { lateClickSuppressionMs: 420, wheelDirection: "up-forward" });
  assert.deepEqual(bundle.resource.samples, [{ domNodes: 118, timers: 3 }]);
  assert.equal(JSON.stringify(bundle).includes("leak"), false);
});

test("bounds resource samples to a fixed window", () => {
  const evidence = createEvidenceCollector({ version: "s02" });
  for (let minute = 0; minute < 40; minute += 1) {
    evidence.recordResourceSample({ elapsedMinutes: minute, domNodes: 100 + minute });
  }
  const bundle = evidence.export();
  assert.equal(bundle.resource.sampleCount, 16);
  assert.equal(bundle.resource.samples.at(-1).elapsedMinutes, 39);
});

test("derives and records a product mode within the allowed set", () => {
  const evidence = createEvidenceCollector({ version: "s02" });
  assert.equal(evidence.setProductMode("CONTROLLED_ACTION_ELIGIBLE"), true);
  assert.equal(evidence.setProductMode("SUPER_USER"), false);
  assert.equal(evidence.export().productMode, "CONTROLLED_ACTION_ELIGIBLE");
});

test("the exported bundle never contains prohibited free text", () => {
  const evidence = createEvidenceCollector({ version: "s02-1", digest: "deadbeef", originClass: "lan" });
  evidence.setCapabilities({ https: true, wss: true, voice: true, secureStorage: true, deviceLock: true, sensors: true });
  evidence.recordResult({ id: "H09", result: "PASS", evidenceId: "S02-E020" });
  // Attempts to smuggle payload through unsupported shapes are ignored.
  evidence.setCapabilities({ transcript: "hello user", https: true });
  evidence.recordResourceSample({ url: "https://host/secret", domNodes: 100 });
  const serialized = JSON.stringify(evidence.export());
  assert.equal(serialized.includes("hello user"), false);
  assert.equal(serialized.includes("secret"), false);
});
