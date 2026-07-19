import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const browserErrors = new WeakMap();
const budgets = JSON.parse(readFileSync(new URL("../../demo/budgets.json", import.meta.url), "utf8"));

async function expectFixedViewport(page) {
  const dimensions = await page.evaluate(() => ({
    innerWidth,
    innerHeight,
    bodyWidth: document.body.scrollWidth,
    bodyHeight: document.body.scrollHeight,
    appWidth: document.querySelector("#app")?.clientWidth,
    appHeight: document.querySelector("#app")?.clientHeight,
    nodes: document.querySelectorAll("#app *").length,
  }));
  expect(dimensions).toEqual({
    innerWidth: 240,
    innerHeight: 292,
    bodyWidth: 240,
    bodyHeight: 292,
    appWidth: 240,
    appHeight: 292,
    nodes: expect.any(Number),
  });
  expect(dimensions.nodes).toBeLessThanOrEqual(budgets.dom.transientNodes);
}

test.beforeEach(async ({ page }) => {
  const errors = [];
  browserErrors.set(page, errors);
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`page: ${error.name}`));
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== "http://127.0.0.1:4173") {
      errors.push(`remote request: ${new URL(request.url()).protocol}`);
    }
  });
  await page.goto("/demo/?debug=1");
  await expect(page.locator("#app")).toHaveAttribute("data-view", "home");
});

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page)).toEqual([]);
});

test("home is fixed, bounded, and responds to semantic wheel input", async ({ page }) => {
  await expectFixedViewport(page);
  await expect(page).toHaveScreenshot("home.png");
  await page.evaluate(() => dispatchEvent(new Event("scrollDown")));
  await expect(page.locator('[aria-current="true"] .row-title')).toContainText("Bridge diagnostics");
  await page.locator(".row").nth(2).dispatchEvent("pointerup");
  await expect(page.locator('[aria-current="true"] .row-title')).toContainText("Transport check");
  await page.locator(".row").nth(2).dispatchEvent("pointerup");
  await expect(page.locator("#app")).toHaveAttribute("data-view", "transport");
});

test("diagnostics screen is deterministic and bounded", async ({ page }) => {
  await page.evaluate(() => dispatchEvent(new Event("sideClick")));
  await expect(page.locator("#app")).toHaveAttribute("data-view", "diagnostics");
  await expectFixedViewport(page);
  await expect(page).toHaveScreenshot("diagnostics.png");
});

test("hold/release reviews a transcript and consumes a trailing click", async ({ page }) => {
  await page.evaluate(() => dispatchEvent(new Event("longPressStart")));
  await expect(page.locator("#app")).toHaveAttribute("data-view", "voice");
  await expect(page).toHaveScreenshot("voice.png");

  await page.waitForTimeout(300);
  await page.evaluate(() => {
    dispatchEvent(new Event("longPressEnd"));
    dispatchEvent(new Event("sideClick"));
  });
  await expect(page.locator("#app")).toHaveAttribute("data-view", "composer");
  await expect(page.locator(".transcript")).toContainText("Show me the latest agent status.");
  await expect(page).toHaveScreenshot("composer.png");
});

test("hidden lifecycle interrupts an active hold without producing a transcript", async ({ page }) => {
  await page.evaluate(() => {
    dispatchEvent(new Event("longPressStart"));
    dispatchEvent(new Event("pagehide"));
  });
  await expect(page.locator("#app")).toHaveAttribute("data-view", "home");
  await expect(page.locator("#app")).not.toContainText("Show me the latest agent status.");
  await page.locator(".row").nth(2).dispatchEvent("pointerup");
  await expect(page.locator('[aria-current="true"] .row-title')).toContainText("Creation probe");
  await page.evaluate(() => {
    dispatchEvent(new Event("pageshow"));
    dispatchEvent(new Event("scrollDown"));
  });
  await expect(page.locator('[aria-current="true"] .row-title')).toContainText("Bridge diagnostics");
});

test("focus, DOM, and diagnostic budgets stay bounded under repeated input", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const latencies = [];
    for (let index = 0; index < 1_000; index += 1) {
      const startedAt = performance.now();
      dispatchEvent(new Event(index % 2 === 0 ? "scrollDown" : "scrollUp"));
      latencies.push(performance.now() - startedAt);
    }
    for (let index = 0; index < 100; index += 1) {
      dispatchEvent(new Event("sideClick"));
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    }
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const entries = window.__probeDebug.diagnostics();
    latencies.sort((a, b) => a - b);
    return {
      view: document.querySelector("#app")?.dataset.view,
      nodes: document.querySelectorAll("#app *").length,
      entries: entries.length,
      diagnosticBytes: new TextEncoder().encode(JSON.stringify(entries)).byteLength,
      p95: latencies[Math.floor(latencies.length * 0.95)],
    };
  });

  expect(result.view).toBe("home");
  expect(result.nodes).toBeLessThanOrEqual(budgets.dom.steadyNodes);
  expect(result.entries).toBeLessThanOrEqual(budgets.diagnostics.entries);
  expect(result.diagnosticBytes).toBeLessThanOrEqual(budgets.diagnostics.serializedBytes);
  expect(result.p95).toBeLessThan(100);
});

test("native too-short and start failure each produce one sanitized terminal event", async ({ page }) => {
  await page.addInitScript(() => {
    window.__voiceMode = "normal";
    window.CreationVoiceHandler = {
      postMessage(message) {
        if (message === "start" && window.__voiceMode === "throw") throw new Error("canary secret");
      },
    };
  });
  await page.reload();

  await page.evaluate(() => {
    dispatchEvent(new Event("longPressStart"));
    dispatchEvent(new Event("longPressEnd"));
  });
  await expect(page.locator("#app")).toHaveAttribute("data-view", "home");
  const tooShort = await page.evaluate(() => window.__probeDebug.diagnostics()
    .filter((entry) => entry.type === "voice" && entry.code === "too-short"));
  expect(tooShort).toHaveLength(1);

  await page.evaluate(() => {
    window.__voiceMode = "throw";
    dispatchEvent(new Event("longPressStart"));
  });
  await expect(page.locator("#app")).toHaveAttribute("data-view", "home");
  const diagnostics = await page.evaluate(() => window.__probeDebug.diagnostics());
  const bridgeErrors = diagnostics.filter((entry) => entry.type === "voice" && entry.code === "bridge-error");
  expect(bridgeErrors).toHaveLength(1);
  expect(JSON.stringify(diagnostics)).not.toContain("canary secret");
  expect(await page.evaluate(() => Object.keys(window.__probeDebug))).toEqual(["diagnostics"]);
});
