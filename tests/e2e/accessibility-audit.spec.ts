import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("administrator sign-in has a main landmark and is keyboard operable", async ({ page }) => {
  test.setTimeout(90_000);
  await page.route("**/api/auth/admin/login", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: "{}" }),
  );
  await page.goto("/authentication");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Administrator sign in", level: 1 }),
  ).toBeVisible();

  const identifier = page.getByRole("textbox", { name: "Username or email" });
  await page.keyboard.press("Tab");
  await expect(identifier).toBeFocused();
  await page.keyboard.type("not-an-admin@example.com");
  await page.keyboard.press("Tab");
  const password = page.locator('input[name="password"]');
  await expect(password).toBeFocused();
  await page.keyboard.type("not-a-real-password");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: "Invalid credentials." })).toBeVisible();

  const scan = await new AxeBuilder({ page }).analyze();
  expect(
    scan.violations.filter((issue) => ["critical", "serious"].includes(issue.impact ?? "")),
  ).toEqual([]);
});
