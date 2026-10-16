import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const locales = [
  { locale: "en", title: "Our Story" },
  { locale: "pt-PT", title: "A nossa história" },
  { locale: "fa", title: "داستان ما" },
] as const;

for (const { locale, title } of locales) {
  test(`About page renders in ${locale} without horizontal overflow`, async ({ page }) => {
    await page
      .context()
      .addCookies([{ name: "SARA_LOCALE", value: locale, url: "http://127.0.0.1:3100/" }]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/about");
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole("link", { name: /menu|ementa|منو/iu }).first()).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}

test("About page has no automatically detectable accessibility issues", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations).toEqual([]);
});
