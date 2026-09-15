import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const responsiveCases = [
  { desktop: false, height: 844, name: "phone", width: 390 },
  { desktop: false, height: 1024, name: "tablet", width: 768 },
  { desktop: true, height: 900, name: "desktop", width: 1024 },
  { desktop: true, height: 1000, name: "wide", width: 1440 },
] as const;

for (const viewport of responsiveCases) {
  test(`${viewport.name} storefront shell uses the intended navigation mode`, async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(message.text());
    });
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    await page.setViewportSize(viewport);
    await page.goto("/");

    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible({
      visible: viewport.desktop,
    });
    await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible({
      visible: !viewport.desktop,
    });
    await expect(page.getByRole("button", { name: "Open navigation menu" })).toBeVisible({
      visible: !viewport.desktop,
    });
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Cart, 0 items" }).filter({ visible: true }),
    ).toBeVisible();

    const widths = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    expect(widths.document).toBeLessThanOrEqual(widths.viewport);
    expect(runtimeErrors).toEqual([]);

    await test.info().attach(`${viewport.name}-storefront-shell`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  });
}

test("skip link is first, moves focus, and desktop account controls are keyboard reachable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await page.keyboard.press("Tab");
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  const accountButton = page.getByRole("button", { name: "Open account menu" });
  await accountButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu", { name: "Account navigation" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Profile" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Orders" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(accountButton).toBeFocused();
});

test("mobile drawer is keyboard operable and restores its trigger", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const trigger = page.getByRole("button", { name: "Open navigation menu" });
  await trigger.focus();
  await page.keyboard.press("Enter");

  const drawer = page.getByRole("dialog", { name: "Menu" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
  await expect(drawer.getByRole("link", { name: "Contact" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("language selector persists Portuguese without adding a locale slug", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await page.getByRole("button", { name: "Language" }).click();
  await page.getByRole("menuitem", { name: "Português" }).click();

  await expect(page.locator("html")).toHaveAttribute("lang", "pt-PT");
  await expect(page).toHaveURL("http://127.0.0.1:3100/");
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeVisible();
});

test("Persian shell mirrors the end-side drawer and has no detectable accessibility violations", async ({
  context,
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await context.addCookies([{ name: "SARA_LOCALE", value: "fa", url: "http://127.0.0.1:3100/" }]);
  await page.goto("/");

  await page.getByRole("button", { name: "باز کردن منوی پیمایش" }).click();
  const drawer = page.getByRole("dialog", { name: "منو" });
  // The physical anchor is correct after MUI's slide transition completes.
  await expect.poll(async () => (await drawer.boundingBox())?.x ?? Infinity).toBeLessThan(10);

  await page.keyboard.press("Escape");
  const scan = await new AxeBuilder({ page }).analyze();
  expect(scan.violations).toEqual([]);
});
