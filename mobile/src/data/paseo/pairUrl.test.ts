import test from "node:test";
import assert from "node:assert/strict";

import { parsePairUrl } from "./pairUrl.ts";

test("parses a query-style pair url", () => {
  const info = parsePairUrl("paseo://pair?relay=wss%3A%2F%2Frelay.example%2Fh1&host=h1&token=abc123");
  assert.equal(info.relayEndpoint, "wss://relay.example/h1");
  assert.equal(info.hostId, "h1");
  assert.equal(info.secret, "abc123");
});

test("uses a bare wss url as the relay endpoint", () => {
  const info = parsePairUrl("wss://relay.example/socket");
  assert.equal(info.relayEndpoint, "wss://relay.example/socket");
});

test("keeps the raw string and tolerates missing fields", () => {
  const info = parsePairUrl("  https://pair.example/x  ");
  assert.equal(info.raw, "https://pair.example/x");
  assert.equal(info.relayEndpoint, undefined);
  assert.equal(info.hostId, undefined);
});
