import { test, expect } from "@playwright/test";

async function shellGeometry(page) {
  return page.evaluate(() => ({
    viewport: [innerWidth, innerHeight],
    document: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
    app: [document.querySelector("#app")?.clientWidth, document.querySelector("#app")?.clientHeight],
  }));
}

function watchPageFailures(page) {
  const failures = [];
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => failures.push(`page: ${error.message}`));
  page.on("requestfailed", (request) => failures.push(`request: ${request.url()}`));
  return failures;
}

test("@production browser and Rabbit fixtures run the same capability-first shell", async ({ page }) => {
  const failures = watchPageFailures(page);
  await page.goto("/dist/production/?fixture=supported");
  await expect(page.locator("#app")).toHaveAttribute("data-screen", "ready");
  await expect(page.locator("#app")).toHaveAttribute("data-platform", "browser");
  await expect(page.locator('[aria-current="true"]')).toContainText("DEVICE CAPABILITIES");
  await expect(page).toHaveScreenshot("production-ready.png");
  await page.keyboard.press("ArrowDown");
  await expect(page.locator('[aria-current="true"]')).toContainText("RELAY NOT CONFIGURED");
  const browserText = await page.locator("#app").innerText();
  expect(await shellGeometry(page)).toEqual({
    viewport: [240, 282],
    document: [240, 282],
    app: [240, 282],
  });

  await page.addInitScript(() => {
    window.CreationVoiceHandler = { postMessage() {} };
    window.creationStorage = { secure: {} };
  });
  await page.goto("/dist/production/?fixture=supported");
  await expect(page.locator("#app")).toHaveAttribute("data-platform", "rabbit");
  await page.evaluate(() => dispatchEvent(new Event("scrollDown")));
  await expect(page.locator('[aria-current="true"]')).toContainText("RELAY NOT CONFIGURED");
  expect(await page.locator("#app").innerText()).toBe(browserText);
  expect(failures).toEqual([]);
});

test("@production default shell fails closed before product data", async ({ page }) => {
  const failures = watchPageFailures(page);
  await page.goto("/dist/production/");
  await expect(page.locator("#app")).toHaveAttribute("data-screen", "unsupported");
  await expect(page.locator("#app")).toContainText("NO DATA");
  await expect(page.locator("#app")).not.toContainText("WORKSPACE");
  await expect(page.locator("#app")).not.toContainText("AGENT");
  await expect(page).toHaveScreenshot("production-unsupported.png");
  expect(failures).toEqual([]);
});

test("@production page rejects touch commands after backgrounding", async ({ page }) => {
  await page.goto("/dist/production/?fixture=supported");
  await expect(page.locator('[aria-current="true"]')).toContainText("DEVICE CAPABILITIES");
  await page.evaluate(() => dispatchEvent(new Event("pagehide")));
  await page.getByRole("option", { name: /RELAY NOT CONFIGURED/ }).click();
  await expect(page.locator('[aria-current="true"]')).toContainText("DEVICE CAPABILITIES");
});
