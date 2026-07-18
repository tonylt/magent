import test from "node:test";
import assert from "node:assert/strict";

import { allowsLocalFixtures } from "../../../src/production/fixture.ts";

test("supported capability fixtures are limited to loopback development origins", () => {
  assert.equal(allowsLocalFixtures({ protocol: "http:", hostname: "127.0.0.1" }), true);
  assert.equal(allowsLocalFixtures({ protocol: "http:", hostname: "localhost" }), true);
  assert.equal(allowsLocalFixtures({ protocol: "https:", hostname: "preview.example" }), false);
  assert.equal(allowsLocalFixtures({ protocol: "https:", hostname: "paseo.example" }), false);
});
