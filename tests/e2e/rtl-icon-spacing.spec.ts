import { expect, test } from "@playwright/test";

for (const width of [390, 1280]) {
  test(`button icons have logical spacing in RTL at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/fa/theme-showcase");
    const button = page.getByRole("button", { name: "Preview order" });
    await expect(button).toBeVisible();
    const start = button.locator(".MuiButton-startIcon");
    const end = button.locator(".MuiButton-endIcon");
    await expect(button).toHaveCSS("gap", "8px");
    await expect(start).toHaveCSS("margin-left", "0px");
    await expect(start).toHaveCSS("margin-right", "0px");
    await expect(end).toHaveCSS("margin-left", "0px");
    await expect(end).toHaveCSS("margin-right", "0px");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test("LTR buttons retain spacing on the correct side", async ({ page }) => {
  await page.goto("/en/theme-showcase");
  const button = page.getByRole("button", { name: "Preview order" });
  await expect(button).toHaveCSS("gap", "8px");
  await expect(button.locator(".MuiButton-startIcon")).toHaveCSS("margin", "0px");
  await expect(button.locator(".MuiButton-endIcon")).toHaveCSS("margin", "0px");
});
