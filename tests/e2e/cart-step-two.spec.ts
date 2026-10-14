import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("checkout address step gates guests and stays usable on mobile", async ({ page }) => {
  await page.route("**/api/auth/customer/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { authenticated: false } }),
    }),
  );
  await page.route("**/api/cart", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: null }),
    }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cart/address");
  await expect(page.getByRole("heading", { name: "Pickup or delivery", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" }).last()).toHaveAttribute(
    "href",
    "/login?returnTo=%2Fcart%2Faddress",
  );
  const widths = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
  const scan = await new AxeBuilder({ page }).analyze();
  expect(scan.violations).toEqual([]);
});
