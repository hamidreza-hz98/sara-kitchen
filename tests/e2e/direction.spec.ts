import { expect, test } from "@playwright/test";

const directionCases = [
  { name: "phone", width: 390, height: 844 },
  { name: "wide", width: 1440, height: 1000 },
] as const;

for (const viewport of directionCases) {
  for (const localeCase of [
    { locale: "en", direction: "ltr", cacheKey: "sara-mui", arrowTransform: "none" },
    { locale: "fa", direction: "rtl", cacheKey: "sara-mui-rtl", arrowTransform: "matrix" },
  ] as const) {
    test(`${viewport.name} ${localeCase.direction} layout remains direction-safe`, async ({
      context,
      page,
    }) => {
      await page.setViewportSize(viewport);
      await context.addCookies([
        {
          name: "SARA_LOCALE",
          value: localeCase.locale,
          url: "http://127.0.0.1:3100/",
        },
      ]);
      await page.goto("/theme-showcase");

      const showcase = page.getByTestId("theme-showcase");
      await expect(showcase).toHaveAttribute("data-hydrated", "true");
      await expect(showcase).toHaveAttribute("data-theme-direction", localeCase.direction);
      await expect(page.locator("html")).toHaveAttribute("dir", localeCase.direction);
      await expect(
        page.locator(`head style[data-emotion^="${localeCase.cacheKey}"]`).first(),
      ).toBeAttached();

      const arrowTransform = await page
        .getByTestId("directional-arrow")
        .evaluate((element) => getComputedStyle(element).transform);
      expect(arrowTransform).toContain(localeCase.arrowTransform);
      await expect(page.getByTestId("static-kitchen-icon")).toHaveCSS("transform", "none");

      const layoutBounds = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        showcaseLeft: document
          .querySelector('[data-testid="theme-showcase"]')
          ?.getBoundingClientRect().left,
        showcaseRight: document
          .querySelector('[data-testid="theme-showcase"]')
          ?.getBoundingClientRect().right,
      }));

      expect(layoutBounds.documentWidth).toBeLessThanOrEqual(layoutBounds.viewportWidth);
      expect(layoutBounds.showcaseLeft).toBeGreaterThanOrEqual(0);
      expect(layoutBounds.showcaseRight).toBeLessThanOrEqual(layoutBounds.viewportWidth);

      await page.getByRole("button", { name: "Preview order" }).click();
      const dialog = page.getByRole("dialog", { name: "Preview order" });
      const closeButton = page.getByRole("button", { name: "Close order preview" });
      const [dialogBox, closeBox] = await Promise.all([
        dialog.boundingBox(),
        closeButton.boundingBox(),
      ]);

      expect(dialogBox).not.toBeNull();
      expect(closeBox).not.toBeNull();
      if (dialogBox && closeBox) {
        const dialogCenter = dialogBox.x + dialogBox.width / 2;
        const closeCenter = closeBox.x + closeBox.width / 2;
        expect(closeCenter > dialogCenter).toBe(localeCase.direction === "ltr");
      }

      const screenshotPath = test.info().outputPath(`${viewport.name}-${localeCase.direction}.png`);
      await page.screenshot({ fullPage: true, path: screenshotPath });
      await test.info().attach(`${viewport.name}-${localeCase.direction}`, {
        path: screenshotPath,
        contentType: "image/png",
      });
    });
  }
}
