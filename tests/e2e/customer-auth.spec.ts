import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("profile routes redirect anonymous visitors to customer sign-in", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/login$/u);
  await page.goto("/profile/orders");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/login$/u);
});

test("customer sign-in and logout signals update another tab", async ({ context, page }) => {
  let authenticated = false;
  let loginPayload: Record<string, unknown> | undefined;
  await context.route("**/api/auth/customer/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: authenticated
          ? { authenticated: true, displayName: "Sara Kazemi" }
          : { authenticated: false },
        requestId: "browser-test",
      }),
    });
  });
  await context.route("**/api/auth/customer/login", async (route) => {
    loginPayload = route.request().postDataJSON() as Record<string, unknown>;
    authenticated = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { authenticated: true, displayName: "Sara Kazemi" },
        requestId: "browser-test",
      }),
    });
  });
  await context.route("**/api/auth/customer/logout", async (route) => {
    authenticated = false;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { authenticated: false }, requestId: "browser-test" }),
    });
  });

  const secondTab = await context.newPage();
  await secondTab.goto("/");
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Mobile number or email" }).fill("912345678");
  await page.locator('input[name="password"]').fill("A strong customer passphrase 2026");
  await page.getByRole("checkbox", { name: "Keep me signed in on this device" }).check();
  await page.getByRole("button", { name: "Sign in" }).click();
  expect(loginPayload).toMatchObject({ identifier: "912345678", persistent: true });

  await secondTab.getByRole("button", { name: "Open account menu" }).click();
  await expect(secondTab.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
  await secondTab.getByRole("menuitem", { name: "Sign out" }).click();
  await secondTab.getByRole("button", { name: "Open account menu" }).click();
  await expect(secondTab.getByRole("menuitem", { name: "Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Open account menu" }).click();
  await expect(page.getByRole("menuitem", { name: "Sign in" })).toBeVisible();
});

test("customer sign-in is accessible on Persian mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .context()
    .addCookies([{ name: "SARA_LOCALE", value: "fa", domain: "127.0.0.1", path: "/" }]);
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "ورود" })).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});
