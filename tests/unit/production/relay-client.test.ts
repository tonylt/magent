import test from "node:test";
import assert from "node:assert/strict";

import { traceRelayCompatibility } from "../../../src/production/relay/relay-client.ts";
import {
  SENSITIVE_SENTINELS,
  endpointScripts,
  validOffer,
} from "../../../src/production/relay/fixtures.ts";
import { createScriptedTransport } from "../../../src/production/relay/transport.ts";

async function trace(scriptName: keyof typeof endpointScripts, offer = validOffer()) {
  const transport = createScriptedTransport(endpointScripts[scriptName]);
  return traceRelayCompatibility({ transport, offer });
}

test("a well-behaved relay endpoint traces as supported", async () => {
  const report = await trace("wellBehaved");
  assert.equal(report.compatibility, "supported");
  assert.equal(report.stage, "complete");
  assert.equal(report.failure, undefined);
  assert.equal(report.framesValidated, 2);
  assert.equal(report.hostId, "host-fixture");
  assert.equal(report.relayId, "relay-fixture");
});

test("an invalid imported offer fails visibly before connecting", async () => {
  const transport = createScriptedTransport(endpointScripts.wellBehaved);
  const report = await traceRelayCompatibility({ transport, offer: { v: 1 } });
  assert.equal(report.compatibility, "unsupported");
  assert.equal(report.stage, "offer");
  assert.equal(report.failure, "MALFORMED OFFER");
  assert.equal(transport.sent.length, 0, "must not send hello when the offer is malformed");
});

test("an old relay protocol traces as upgrade-required at the hello stage", async () => {
  const report = await trace("protocolTooOld");
  assert.equal(report.compatibility, "upgrade-required");
  assert.equal(report.stage, "hello");
  assert.equal(report.failure, "RELAY PROTOCOL TOO OLD");
});

test("a relay demanding a newer client traces as upgrade-required", async () => {
  const report = await trace("minClientNotMet");
  assert.equal(report.compatibility, "upgrade-required");
  assert.equal(report.stage, "hello");
  assert.equal(report.failure, "CLIENT UPGRADE REQUIRED");
});

test("a malformed hello-ack traces as unsupported", async () => {
  const report = await trace("malformedHelloAck");
  assert.equal(report.compatibility, "unsupported");
  assert.equal(report.stage, "hello");
  assert.equal(report.failure, "MALFORMED HELLO ACK");
});

test("a rejected subscription traces as unsupported at the subscribe stage", async () => {
  const report = await trace("subscriptionRejected");
  assert.equal(report.compatibility, "unsupported");
  assert.equal(report.stage, "subscribe");
  assert.equal(report.failure, "SUBSCRIPTION REJECTED");
});

test("a malformed frame traces as unsupported at the frame stage", async () => {
  const report = await trace("malformedFrame");
  assert.equal(report.compatibility, "unsupported");
  assert.equal(report.stage, "frame");
  assert.equal(report.failure, "MALFORMED FRAME");
});

test("a frame sequence gap traces as unsupported at the frame stage", async () => {
  const report = await trace("frameSequenceGap");
  assert.equal(report.compatibility, "unsupported");
  assert.equal(report.stage, "frame");
  assert.equal(report.failure, "FRAME SEQUENCE GAP");
});

test("a transport closed mid-handshake traces as unsupported", async () => {
  const report = await trace("closeMidHandshake");
  assert.equal(report.compatibility, "unsupported");
  assert.equal(report.failure, "TRANSPORT CLOSED");
});

test("the compatibility report never carries sensitive relay payload", async () => {
  for (const name of Object.keys(endpointScripts) as (keyof typeof endpointScripts)[]) {
    const report = await trace(name);
    const serialized = JSON.stringify(report);
    for (const sentinel of SENSITIVE_SENTINELS) {
      assert.equal(serialized.includes(sentinel), false, `${name} leaked ${sentinel}`);
    }
  }
});
