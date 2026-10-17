import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

const cases = [
  { locale: "en", direction: "ltr", menuTitle: "Our menu" },
  { locale: "pt-PT", direction: "ltr", menuTitle: "O nosso menu" },
  { locale: "fa", direction: "rtl", menuTitle: "منوی ما" },
] as const;

for (const entry of cases) {
  test(`${entry.locale} copy and direction fit mobile and desktop`, async ({ context, page }) => {
    test.setTimeout(180_000);
    await context.addCookies([
      { name: "SARA_LOCALE", value: entry.locale, url: "http://127.0.0.1:3100/" },
    ]);
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      for (const path of ["/", "/menu", "/contact", "/theme-showcase/dashboard-shell"]) {
        const response = await page.goto(path);
        expect(response?.status(), `${entry.locale} ${path} at ${width}px`).toBe(200);
        await expect(page.locator("html")).toHaveAttribute("lang", entry.locale);
        await expect(page.locator("html")).toHaveAttribute("dir", entry.direction);
        await expect(page.getByRole("main")).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
          ),
          `${entry.locale} ${path} at ${width}px overflows`,
        ).toBe(true);
        const title = page.getByRole("heading", { level: 1 }).first();
        await expect(title).toBeVisible();
        if (path === "/menu") await expect(title).toHaveText(entry.menuTitle);
        expect(
          await title.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
          `${entry.locale} ${path} at ${width}px clips its title`,
        ).toBe(true);
        const routeName = path === "/" ? "home" : path.slice(1).replaceAll("/", "-");
        const screenshotName = `${entry.locale}-${width}-${routeName}`;
        const screenshotsDirectory = process.env.SARA_LOCALIZATION_SHOTS_DIR;
        if (screenshotsDirectory) await mkdir(screenshotsDirectory, { recursive: true });
        const screenshot = await page.screenshot({
          fullPage: true,
          ...(screenshotsDirectory
            ? { path: join(screenshotsDirectory, `${screenshotName}.png`) }
            : {}),
        });
        await test.info().attach(screenshotName, {
          body: screenshot,
          contentType: "image/png",
        });
      }
    }
  });
}

test("selected locale persists across navigation and reload without a locale path", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Language" }).click();
  await page.getByRole("menuitem", { name: "فارسی" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.goto("/menu");
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await expect(page).toHaveURL("http://127.0.0.1:3100/menu");
});
