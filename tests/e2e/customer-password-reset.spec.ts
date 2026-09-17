import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("forgot-password request always presents a generic result", async ({ page }) => {
  let identifier: string | undefined;
  await page.route("**/api/auth/customer/password-reset/request", async (route) => {
    identifier = (route.request().postDataJSON() as { identifier: string }).identifier;
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { accepted: true }, requestId: "browser-test" }),
    });
  });
  await page.goto("/forgot-password");
  await page.getByRole("textbox", { name: "Mobile number or email" }).fill("sara@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  expect(identifier).toBe("sara@example.com");
  await expect(page.getByRole("status")).toContainText("If an eligible account exists");
});

test("reset link is removed from browser URL and a valid flow signs out old sessions", async ({
  page,
}) => {
  let submitted: Record<string, unknown> | undefined;
  await page.route("**/api/auth/customer/password-reset/complete", async (route) => {
    submitted = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { reset: true }, requestId: "browser-test" }),
    });
  });
  const token = "A".repeat(43);
  await page.goto(`/reset-password#token=${token}`);
  await expect(page).toHaveURL(/\/reset-password$/u);
  await page.locator('input[name="newPassword"]').fill("A different secure passphrase 2026");
  await page.locator('input[name="confirmPassword"]').fill("A different secure passphrase 2026");
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page.getByRole("status")).toContainText(
    "All previous sessions have been signed out",
  );
  expect(submitted).toMatchObject({ token, newPassword: "A different secure passphrase 2026" });
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("invalid and missing reset links cannot submit and Persian mobile layout is accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .context()
    .addCookies([{ name: "SARA_LOCALE", value: "fa", domain: "127.0.0.1", path: "/" }]);
  await page.goto("/reset-password");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("button", { name: "بازنشانی گذرواژه" })).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("نامعتبر");
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});
