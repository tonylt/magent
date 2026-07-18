import test from "node:test";
import assert from "node:assert/strict";

import {
  CLIENT_VERSION,
  MIN_RELAY_PROTOCOL,
  buildClientHello,
  validateFrame,
  validateHelloAck,
  validateOffer,
  validateSubscribeAck,
} from "../../../src/production/relay/protocol.ts";
import {
  frameSeq,
  helloAck,
  keylessOffer,
  insecureOffer,
  malformedOffer,
  validOffer,
} from "../../../src/production/relay/fixtures.ts";

test("client hello pins the current protocol and client version", () => {
  const hello = buildClientHello();
  assert.equal(hello.t, "hello");
  assert.equal(hello.protocol, CLIENT_VERSION);
  assert.equal(hello.minRelay, MIN_RELAY_PROTOCOL);
  assert.ok(Array.isArray(hello.capabilities));
});

test("valid hello-ack passes with relay identity metadata", () => {
  const result = validateHelloAck(helloAck({}));
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.relay.id, "relay-fixture");
});

test("hello-ack below the pinned protocol requires an upgrade", () => {
  const result = validateHelloAck(helloAck({ protocol: MIN_RELAY_PROTOCOL - 1 }));
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.compatibility, "upgrade-required");
    assert.equal(result.failure, "RELAY PROTOCOL TOO OLD");
  }
});

test("hello-ack demanding a newer client requires an upgrade", () => {
  const result = validateHelloAck(helloAck({ minClient: CLIENT_VERSION + 1 }));
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.compatibility, "upgrade-required");
    assert.equal(result.failure, "CLIENT UPGRADE REQUIRED");
  }
});

test("malformed hello-ack is unsupported", () => {
  for (const raw of [null, {}, { t: "hello-ack" }, { t: "nope", protocol: 3, minClient: 3, relay: { id: "x" } }]) {
    const result = validateHelloAck(raw);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.compatibility, "unsupported");
      assert.equal(result.failure, "MALFORMED HELLO ACK");
    }
  }
});

test("valid relay offer parses host identity only", () => {
  const result = validateOffer(validOffer());
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.host.id, "host-fixture");
});

test("malformed offer is unsupported", () => {
  const result = validateOffer(malformedOffer());
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.compatibility, "unsupported");
    assert.equal(result.failure, "MALFORMED OFFER");
  }
});

test("non-wss relay endpoint is an insecure endpoint failure", () => {
  const result = validateOffer(insecureOffer());
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.failure, "INSECURE RELAY ENDPOINT");
});

test("offer without a public key is a missing key failure", () => {
  const result = validateOffer(keylessOffer());
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.failure, "MISSING RELAY KEY");
});

test("subscribe-ack must cover every requested topic", () => {
  const requested = ["directory", "attention"] as const;
  const ok = validateSubscribeAck({ t: "subscribe-ack", topics: ["directory", "attention"] }, requested);
  assert.equal(ok.ok, true);

  const partial = validateSubscribeAck({ t: "subscribe-ack", topics: ["directory"] }, requested);
  assert.equal(partial.ok, false);
  if (!partial.ok) {
    assert.equal(partial.compatibility, "unsupported");
    assert.equal(partial.failure, "SUBSCRIPTION REJECTED");
  }

  const wrongType = validateSubscribeAck({ t: "error" }, requested);
  assert.equal(wrongType.ok, false);
  if (!wrongType.ok) assert.equal(wrongType.failure, "SUBSCRIPTION REJECTED");
});

test("frame must be well formed and strictly sequential", () => {
  const first = validateFrame(frameSeq(1), 0);
  assert.equal(first.ok, true);

  const gap = validateFrame(frameSeq(3), 1);
  assert.equal(gap.ok, false);
  if (!gap.ok) assert.equal(gap.failure, "FRAME SEQUENCE GAP");

  const malformed = validateFrame({ t: "frame", seq: 1, nonce: "n", ciphertext: "c" }, 0);
  assert.equal(malformed.ok, false);
  if (!malformed.ok) assert.equal(malformed.failure, "MALFORMED FRAME");
});
