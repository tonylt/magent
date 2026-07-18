import { test, expect } from "@playwright/test";

async function shellGeometry(page) {
  return page.evaluate(() => ({
    viewport: [innerWidth, innerHeight],
    document: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
    app: [document.querySelector("#app")?.clientWidth, document.querySelector("#app")?.clientHeight],
  }));
}

test("@production browser and Rabbit fixtures run the same capability-first shell", async ({ page }) => {
  await page.goto("/dist/production/?fixture=supported");
  await expect(page.locator("#app")).toHaveAttribute("data-screen", "ready");
  await expect(page.locator("#app")).toHaveAttribute("data-platform", "browser");
  await expect(page.locator('[aria-current="true"]')).toContainText("DEVICE CAPABILITIES");
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
});

test("@production default shell fails closed before product data", async ({ page }) => {
  await page.goto("/dist/production/");
  await expect(page.locator("#app")).toHaveAttribute("data-screen", "unsupported");
  await expect(page.locator("#app")).toContainText("NO DATA");
  await expect(page.locator("#app")).not.toContainText("WORKSPACE");
  await expect(page.locator("#app")).not.toContainText("AGENT");
});
