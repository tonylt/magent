import test from "node:test";
import assert from "node:assert/strict";

import { negotiate } from "../../../src/production/negotiation.ts";
import type { GateDecision } from "../../../src/production/contracts.ts";
import type { CompatibilityReport } from "../../../src/production/relay/relay-client.ts";

const deviceSupported: GateDecision = { compatibility: "supported", reasons: [] };
const deviceLimited: GateDecision = { compatibility: "limited", reasons: ["NO SECURE STORAGE"] };
const deviceUnsupported: GateDecision = { compatibility: "unsupported", reasons: ["NO CRYPTO"] };

function relay(report: Partial<CompatibilityReport>): CompatibilityReport {
  return { compatibility: "supported", stage: "complete", framesValidated: 2, ...report };
}

test("device-hardware unsupported never contacts the relay and is not recoverable", () => {
  const outcome = negotiate(deviceUnsupported, relay({ compatibility: "supported" }));
  assert.equal(outcome.compatibility, "unsupported");
  assert.equal(outcome.recoverable, false);
  assert.equal(outcome.source, "device");
  assert.deepEqual(outcome.reasons, ["NO CRYPTO"]);
});

test("device-only supported mode mirrors the device decision", () => {
  const outcome = negotiate(deviceSupported);
  assert.equal(outcome.compatibility, "supported");
  assert.equal(outcome.source, "device");
  assert.equal(outcome.relayNegotiated, false);
});

test("device-only limited mode carries device reasons", () => {
  const outcome = negotiate(deviceLimited);
  assert.equal(outcome.compatibility, "limited");
  assert.deepEqual(outcome.reasons, ["NO SECURE STORAGE"]);
  assert.equal(outcome.relayNegotiated, false);
});

test("relay upgrade-required is recoverable and reports the failure label", () => {
  const outcome = negotiate(deviceSupported, relay({ compatibility: "upgrade-required", stage: "hello", failure: "CLIENT UPGRADE REQUIRED" }));
  assert.equal(outcome.compatibility, "upgrade-required");
  assert.equal(outcome.recoverable, true);
  assert.equal(outcome.source, "relay");
  assert.deepEqual(outcome.reasons, ["CLIENT UPGRADE REQUIRED"]);
});

test("relay unsupported is recoverable and reports the failure label", () => {
  const outcome = negotiate(deviceSupported, relay({ compatibility: "unsupported", stage: "frame", failure: "FRAME SEQUENCE GAP" }));
  assert.equal(outcome.compatibility, "unsupported");
  assert.equal(outcome.recoverable, true);
  assert.equal(outcome.source, "relay");
  assert.deepEqual(outcome.reasons, ["FRAME SEQUENCE GAP"]);
});

test("relay supported with a limited device stays read-only limited", () => {
  const outcome = negotiate(deviceLimited, relay({ compatibility: "supported" }));
  assert.equal(outcome.compatibility, "limited");
  assert.equal(outcome.source, "device");
  assert.equal(outcome.relayNegotiated, true);
  assert.deepEqual(outcome.reasons, ["NO SECURE STORAGE"]);
});

test("relay supported with a supported device negotiates as relay-compatible", () => {
  const outcome = negotiate(deviceSupported, relay({ compatibility: "supported" }));
  assert.equal(outcome.compatibility, "supported");
  assert.equal(outcome.source, "relay");
  assert.equal(outcome.relayNegotiated, true);
  assert.equal(outcome.recoverable, false);
});
