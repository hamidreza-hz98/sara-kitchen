import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const viewports = [
  { name: "phone", width: 390, height: 844, headingSize: "30px", tableVisible: false },
  { name: "small", width: 700, height: 900, headingSize: "30px", tableVisible: false },
  { name: "tablet", width: 900, height: 1100, headingSize: "40px", tableVisible: true },
  { name: "wide", width: 1440, height: 1000, headingSize: "48px", tableVisible: true },
] as const;

for (const viewport of viewports) {
  for (const mode of ["light", "dark"] as const) {
    test(`${viewport.name} layout honors ${mode} theme tokens`, async ({ page }) => {
      const runtimeErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") runtimeErrors.push(message.text());
      });
      page.on("pageerror", (error) => runtimeErrors.push(error.message));

      await page.setViewportSize(viewport);
      await page.addInitScript(
        ({ selectedMode }) => localStorage.setItem("sara-kitchen-mode", selectedMode),
        { selectedMode: mode },
      );
      await page.goto("/theme-showcase");

      const showcase = page.getByTestId("theme-showcase");
      const heading = page.getByRole("heading", {
        level: 1,
        name: "Warm hospitality, translated into every component.",
      });

      await expect(showcase).toBeVisible();
      await expect(showcase).toHaveAttribute("data-hydrated", "true");
      await expect(page.locator("html")).toHaveClass(new RegExp(`(^|\\s)${mode}(\\s|$)`));
      await expect(heading).toHaveCSS("font-size", viewport.headingSize);
      await expect(page.locator("table")).toBeVisible({ visible: viewport.tableVisible });
      await expect(page.getByTestId("primary-action")).toHaveCSS(
        "background-color",
        "rgb(255, 97, 97)",
      );
      await expect(page.locator(".MuiCard-root").first()).toHaveCSS("border-radius", "16px");

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(hasHorizontalOverflow).toBe(false);

      await test.info().attach(`${viewport.name}-${mode}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
      expect(runtimeErrors).toEqual([]);
    });
  }
}

for (const mode of ["light", "dark"] as const) {
  test(`${mode} showcase has no automatically detectable accessibility violations`, async ({
    page,
  }) => {
    await page.addInitScript(
      ({ selectedMode }) => localStorage.setItem("sara-kitchen-mode", selectedMode),
      { selectedMode: mode },
    );
    await page.goto("/theme-showcase");
    await expect(page.getByTestId("theme-showcase")).toHaveAttribute("data-hydrated", "true");

    const scan = await new AxeBuilder({ page }).analyze();
    expect(scan.violations).toEqual([]);
  });
}

test("shared primitives support keyboard operation and restore overlay focus", async ({ page }) => {
  await page.goto("/theme-showcase");

  const dialogTrigger = page.getByRole("button", { name: "Preview order" });
  await dialogTrigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Preview order" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Preview order" })).toBeHidden();
  await expect(dialogTrigger).toBeFocused();

  const drawerTrigger = page.getByRole("button", { name: "Open order drawer" });
  await drawerTrigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Order summary" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Order summary" })).toBeHidden();
  await expect(drawerTrigger).toBeFocused();

  await page.getByRole("button", { name: "Notifications" }).focus();
  await expect(page.getByRole("tooltip", { name: "Three unread notifications" })).toBeVisible();

  const secondPage = page.getByRole("button", { name: "Go to page 2" });
  await secondPage.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[aria-current="page"]')).toHaveText("2");
});

test("feedback demo exposes each localized outcome and safe confirmation", async ({ page }) => {
  await page.goto("/theme-showcase");

  const outcomes = [
    ["Show success", "Your changes were saved successfully."],
    ["Show validation", "Some fields need your attention before continuing."],
    ["Show permission", "You do not have access to perform this action."],
    ["Show network error", "The request could not be completed."],
    ["Show unknown error", "Something unexpected happened."],
  ] as const;

  for (const [action, message] of outcomes) {
    await page.getByRole("button", { name: action }).click();
    await expect(page.getByRole("alert").filter({ hasText: message })).toBeVisible();
    await page.getByRole("button", { name: "Dismiss notification" }).click();
    await expect(page.getByRole("alert").filter({ hasText: message })).toBeHidden();
  }

  await page.getByRole("button", { name: "Open confirmation" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete this draft?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Keep draft" })).toBeFocused();
  await dialog.getByRole("button", { name: "Delete draft" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "The draft was deleted." })).toBeVisible();
});

test("offline feedback remains visible and reports recovery", async ({ context, page }) => {
  await page.goto("/theme-showcase");

  await context.setOffline(true);
  await expect(page.getByRole("alert").filter({ hasText: "You're offline" })).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByRole("alert").filter({ hasText: "Back online" })).toBeVisible();
});

test("unknown application URLs use the localized not-found UI", async ({ page }) => {
  await page.goto("/not-a-real-route");

  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Return home" })).toHaveAttribute("href", "/");
});
