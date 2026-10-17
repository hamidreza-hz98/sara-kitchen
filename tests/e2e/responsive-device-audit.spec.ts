import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

test.use({ hasTouch: true });

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const widths = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(widths.content, `${label}: ${JSON.stringify(widths)}`).toBeLessThanOrEqual(
    widths.viewport + 1,
  );
}

test("public pages reflow at narrow, phone, tablet, and wide CSS widths", async ({ page }) => {
  test.setTimeout(180_000);
  for (const viewport of [
    { width: 320, height: 720 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1536, height: 864 },
  ]) {
    await page.setViewportSize(viewport);
    for (const path of ["/", "/menu", "/about", "/contact", "/blog"]) {
      const response = await page.goto(path);
      expect(response?.status(), `${path} at ${viewport.width}px`).toBe(200);
      await expect(page.getByRole("main")).toBeVisible();
      await expectNoHorizontalOverflow(page, `${path} at ${viewport.width}px`);
    }
  }
});

test("long translations, dashboard navigation, and landscape retain usable actions", async ({
  context,
  page,
}) => {
  test.setTimeout(180_000);
  for (const locale of ["pt-PT", "fa"]) {
    await context.addCookies([
      { name: "SARA_LOCALE", value: locale, url: "http://127.0.0.1:3100/" },
    ]);
    for (const viewport of [
      { width: 320, height: 720 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      for (const path of ["/", "/theme-showcase/dashboard-shell"]) {
        const response = await page.goto(path);
        expect(response?.status(), `${locale} ${path} at ${viewport.width}px`).toBe(200);
        await expect(page.getByRole("main")).toBeVisible();
        await expectNoHorizontalOverflow(page, `${locale} ${path} at ${viewport.width}px`);
      }
    }
  }
});

test("mobile navigation touch targets and virtual-keyboard-sized viewport remain operable", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Open navigation menu" });
  const bounds = await menu.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.width).toBeGreaterThanOrEqual(24);
  expect(bounds!.height).toBeGreaterThanOrEqual(24);
  await menu.tap();
  await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/contact");
  await page.setViewportSize({ width: 390, height: 400 });
  const message = page.getByRole("textbox", { name: /message/i });
  await message.focus();
  await expect(message).toBeFocused();
  await expectNoHorizontalOverflow(page, "contact with simulated virtual keyboard");
  const submit = page.getByRole("button", { name: /send/i });
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeVisible();
});

test("public content remains operable with 200% root text enlargement", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/", "/menu", "/contact"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    await expect(page.getByRole("main")).toBeVisible();
    await expectNoHorizontalOverflow(page, `${path} at 200% root text`);
    await expect(page.getByRole("button", { name: "Open navigation menu" })).toBeVisible();
  }
});
