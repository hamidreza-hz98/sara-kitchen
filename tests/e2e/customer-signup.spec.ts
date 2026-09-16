import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("customer can submit signup and receives an identity-neutral result", async ({ page }) => {
  let submitted: Record<string, unknown> | undefined;
  await page.route("**/api/auth/customer/signup", async (route) => {
    submitted = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { accepted: true }, requestId: "browser-test" }),
    });
  });
  await page.goto("/signup");
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await page.getByRole("textbox", { name: "First name" }).fill("Sara");
  await page.getByRole("textbox", { name: "Last name" }).fill("Kazemi");
  await page.getByRole("textbox", { name: "Mobile number" }).fill("912345678");
  await page.locator('input[name="password"]').fill("A long customer passphrase 2026");
  await page.getByRole("checkbox", { name: "I agree to the terms and privacy policy" }).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("status")).toContainText("If these details are eligible");
  expect(submitted).toMatchObject({
    firstName: "Sara",
    mobile: "912345678",
    termsAccepted: true,
    marketingConsent: false,
  });
  await expect(page.getByRole("button", { name: "Create account" })).toBeDisabled();
});

test("signup is usable on mobile and in Persian RTL", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .context()
    .addCookies([{ name: "SARA_LOCALE", value: "fa", domain: "127.0.0.1", path: "/" }]);
  await page.goto("/signup");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "ایجاد حساب" })).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  const widths = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
});
