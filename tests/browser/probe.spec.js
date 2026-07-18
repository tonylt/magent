import { test, expect } from "@playwright/test";

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
    innerHeight: 282,
    bodyWidth: 240,
    bodyHeight: 282,
    appWidth: 240,
    appHeight: 282,
    nodes: expect.any(Number),
  });
  expect(dimensions.nodes).toBeLessThanOrEqual(80);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/demo/");
  await expect(page.locator("#app")).toHaveAttribute("data-view", "home");
});

test("home is fixed, bounded, and responds to semantic wheel input", async ({ page }) => {
  await expectFixedViewport(page);
  await expect(page).toHaveScreenshot("home.png");
  await page.evaluate(() => dispatchEvent(new Event("scrollDown")));
  await expect(page.locator('[aria-current="true"] .row-title')).toContainText("Bridge diagnostics");
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
});
