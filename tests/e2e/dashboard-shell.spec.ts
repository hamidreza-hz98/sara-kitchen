import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const preview = "/theme-showcase/dashboard-shell";

test("actual dashboard routes fail closed without an admin session", async ({ page }) => {
  for (const path of ["/dashboard", "/dashboard/orders/SK-1234"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/authentication$/);
    await expect(
      page.getByText("Administrator sign-in is not available yet.", { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Dashboard navigation" })).toHaveCount(0);
  }
});

for (const viewport of [
  { name: "phone", width: 390, height: 844, desktop: false },
  { name: "tablet", width: 768, height: 1024, desktop: false },
  { name: "desktop", width: 1024, height: 900, desktop: true },
  { name: "wide", width: 1440, height: 900, desktop: true },
]) {
  test(`${viewport.name} dashboard fixture has the intended navigation mode`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.setViewportSize(viewport);
    await page.goto(preview);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Dashboard navigation" })).toBeVisible({
      visible: viewport.desktop,
    });
    await expect(page.getByRole("button", { name: "Open dashboard navigation" })).toBeVisible({
      visible: !viewport.desktop,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
    await test.info().attach(`${viewport.name}-dashboard-shell`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  });
}

test("sidebar collapse persists after refresh and deep links retain active entries and breadcrumbs", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(preview);
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  await page.goto(`${preview}/orders/SK-1234`);
  await expect(
    page
      .getByRole("navigation", { name: "Dashboard navigation" })
      .getByRole("link", { name: "Orders" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("navigation", { name: "Breadcrumbs" })).toContainText("SK-1234");
  await page.reload();
  await expect(page.getByRole("navigation", { name: "Breadcrumbs" })).toContainText("SK-1234");
});

test("mobile drawer, skip link, account menu, and RTL direction remain accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(preview);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to dashboard content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  const trigger = page.getByRole("button", { name: "Open dashboard navigation" });
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "Dashboard navigation" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await page.getByRole("button", { name: "Administrator account" }).click();
  await expect(page.getByRole("menu", { name: "Administrator account" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto(`/fa${preview}`);
  await page.getByRole("button", { name: "باز کردن پیمایش داشبورد" }).click();
  const drawer = page.getByRole("dialog", { name: "پیمایش داشبورد" });
  await expect(drawer).toBeVisible();
  // Wait for the drawer transition before checking its physical RTL start side.
  await expect.poll(async () => (await drawer.boundingBox())?.x ?? Infinity).toBeLessThan(100);
  await page.keyboard.press("Escape");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
