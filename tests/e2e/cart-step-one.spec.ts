import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const viewports = [
  { height: 844, name: "phone", width: 390 },
  { height: 1024, name: "tablet", width: 768 },
  { height: 900, name: "desktop", width: 1280 },
] as const;

for (const viewport of viewports) {
  test(`${viewport.name} cart step one renders without horizontal clipping`, async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(message.text());
    });
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    await page.setViewportSize(viewport);
    await page.goto("/cart");

    await expect(page.getByRole("heading", { name: "Your cart", level: 1 })).toBeVisible();
    await expect(page.getByLabel("Checkout progress")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your cart is empty." })).toBeVisible({
      timeout: 15_000,
    });
    const widths = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    expect(widths.document).toBeLessThanOrEqual(widths.viewport);
    expect(runtimeErrors).toEqual([]);
  });
}

test("empty cart step has no detectable accessibility violations", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: "Your cart is empty." })).toBeVisible({
    timeout: 15_000,
  });
  const scan = await new AxeBuilder({ page }).analyze();
  expect(scan.violations).toEqual([]);
});
