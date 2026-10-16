import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const { locale, title } of [
  { locale: "en", title: "Get in touch" },
  { locale: "pt-PT", title: "Entre em contacto" },
  { locale: "fa", title: "تماس با ما" },
] as const) {
  test(`Contact page is usable on mobile in ${locale}`, async ({ page }) => {
    await page
      .context()
      .addCookies([{ name: "SARA_LOCALE", value: locale, url: "http://127.0.0.1:3100/" }]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/contact");
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
    await expect(page.getByRole("form")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}

test("native form gives validation feedback without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:3100/contact");
  await page
    .getByRole("link", { name: "Contact form / Formulário de contacto / فرم تماس" })
    .click();
  await page.getByRole("textbox", { name: "Full name" }).fill("Sara Kazemi");
  await page.getByRole("textbox", { name: "Message" }).fill("Please tell me about the menu.");
  await page.getByRole("checkbox").check();
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/contact-submissions/form") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Send message" }).click();
  const nativeResponse = await responsePromise;
  expect(
    nativeResponse.status(),
    JSON.stringify({
      origin: await nativeResponse.request().headerValue("origin"),
      host: await nativeResponse.request().headerValue("host"),
      fetchSite: await nativeResponse.request().headerValue("sec-fetch-site"),
      url: nativeResponse.url(),
    }),
  ).toBe(400);
  await expect(
    page.getByText("Please check your name, contact method, message and consent, then try again."),
  ).toBeVisible();
  await context.close();
});

test("Contact page passes automated accessibility checks", async ({ page }) => {
  await page.goto("/contact");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations).toEqual([]);
});

test("enhanced form submits consent and shows success without a navigation", async ({ page }) => {
  let posted: Record<string, unknown> | null = null;
  await page.route("**/api/contact-submissions", async (route) => {
    posted = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 202, contentType: "application/json", body: '{"ok":true}' });
  });
  await page.goto("/contact");
  await page.getByRole("textbox", { name: "Full name" }).fill("Sara Kazemi");
  await page.getByRole("textbox", { name: "Email" }).fill("sara@example.test");
  await page.getByRole("textbox", { name: "Message" }).fill("Please tell me about the menu.");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Thank you. Your message has been received.")).toBeVisible();
  expect(posted).toMatchObject({
    locale: "en",
    privacyAccepted: true,
    pagePath: "/contact",
    email: "sara@example.test",
  });
  expect(page.url()).toContain("/contact");
});

test("forged origin cannot submit the native form", async ({ request }) => {
  const response = await request.post("/api/contact-submissions/form", {
    headers: {
      origin: "https://evil.example",
      "content-type": "application/x-www-form-urlencoded",
    },
    data: new URLSearchParams({
      fullName: "Sara Kazemi",
      email: "sara@example.test",
      message: "Please tell me about the menu.",
      privacyAccepted: "on",
    }).toString(),
  });
  expect(response.status()).toBe(403);
});
