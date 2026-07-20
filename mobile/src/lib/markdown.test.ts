import test from "node:test";
import assert from "node:assert/strict";

import { classifyLine, parseInline } from "./markdown.ts";

test("parseInline splits bold and inline code", () => {
  assert.deepEqual(parseInline("use `edit-article` and **review** it"), [
    { text: "use " },
    { text: "edit-article", code: true },
    { text: " and " },
    { text: "review", bold: true },
    { text: " it" },
  ]);
});

test("parseInline returns a single token for plain text", () => {
  assert.deepEqual(parseInline("just text"), [{ text: "just text" }]);
});

test("classifyLine detects headings, bullets, and ordered items", () => {
  assert.equal(classifyLine("# Title").type, "heading1");
  assert.equal(classifyLine("### Small").type, "heading3");
  assert.equal(classifyLine("- item").type, "bullet");
  assert.equal(classifyLine("• item").type, "bullet");
  const ordered = classifyLine("2. second");
  assert.equal(ordered.type, "ordered");
  assert.equal(ordered.marker, "2.");
  assert.equal(classifyLine("plain line").type, "paragraph");
});
