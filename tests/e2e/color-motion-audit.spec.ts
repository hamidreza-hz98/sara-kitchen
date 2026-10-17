import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const mode of ["light", "dark"] as const) {
  test(`${mode} theme keeps keyboard focus visible and honors reduced motion`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(
      ({ selectedMode }) => localStorage.setItem("sara-kitchen-mode", selectedMode),
      { selectedMode: mode },
    );
    await page.goto("/theme-showcase");
    await expect(page.getByTestId("theme-showcase")).toHaveAttribute("data-hydrated", "true");
    const action = page.getByTestId("primary-action");
    for (let index = 0; index < 30; index += 1) {
      if (await action.evaluate((element) => element === document.activeElement)) break;
      await page.keyboard.press("Tab");
    }
    await expect(action).toBeFocused();
    const styles = await action.evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        outlineColor: computed.outlineColor,
        outlineStyle: computed.outlineStyle,
        outlineWidth: computed.outlineWidth,
        transitionDuration: computed.transitionDuration,
      };
    });
    expect(styles.outlineStyle).toBe("solid");
    expect(styles.outlineWidth).toBe("2px");
    expect(styles.outlineColor).toBe(mode === "light" ? "rgb(201, 54, 67)" : "rgb(255, 97, 97)");
    expect(
      styles.transitionDuration
        .split(",")
        .every((duration) => Number.parseFloat(duration.trim()) <= 0.001),
    ).toBe(true);
    const scan = await new AxeBuilder({ page }).analyze();
    expect(scan.violations.filter((issue) => issue.id === "color-contrast")).toEqual([]);
  });
}

test("hero image scrim follows Persian text direction", async ({ context, page }) => {
  test.setTimeout(90_000);
  await context.addCookies([{ name: "SARA_LOCALE", value: "fa", url: "http://127.0.0.1:3100/" }]);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const hero = page.getByRole("region", { name: "ویژه‌ها" });
  await expect(hero).toBeVisible();
  const scrim = hero.locator(':scope > [aria-hidden="true"]');
  await expect(scrim).toHaveCSS("background-image", /linear-gradient\(270deg/u);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(scrim).toHaveCSS("background-color", "rgba(16, 30, 27, 0.82)");
});

test("public landing pages have no detectable text-contrast failures", async ({ page }) => {
  test.setTimeout(180_000);
  for (const path of ["/", "/about", "/contact", "/blog"]) {
    await page.goto(path);
    await expect(page.getByRole("main")).toBeVisible();
    const scan = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
    expect(scan.violations, `contrast violation on ${path}`).toEqual([]);
  }
});

test("commerce and administration entry surfaces have no text-contrast failures", async ({
  page,
}) => {
  test.setTimeout(180_000);
  for (const path of [
    "/menu",
    "/login",
    "/authentication",
    "/cart",
    "/theme-showcase/dashboard-shell",
  ]) {
    await page.goto(path);
    await expect(page.getByRole("main")).toBeVisible();
    const scan = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
    expect(scan.violations, `contrast violation on ${path}`).toEqual([]);
  }
});

test("dark public pages have no detectable text-contrast failures", async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => localStorage.setItem("sara-kitchen-mode", "dark"));
  for (const path of ["/", "/about", "/contact", "/blog", "/menu"]) {
    await page.goto(path);
    await expect(page.getByRole("main")).toBeVisible();
    const scan = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
    expect(scan.violations, `dark contrast violation on ${path}`).toEqual([]);
  }
});
