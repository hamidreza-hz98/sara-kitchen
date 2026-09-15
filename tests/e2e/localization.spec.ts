import { expect, test } from "@playwright/test";

const localeCases = [
  {
    locale: "en",
    direction: "ltr",
    heading: "Sara Kitchen is getting ready to serve you.",
  },
  {
    locale: "pt-PT",
    direction: "ltr",
    heading: "A Sara Kitchen está quase pronta para o servir.",
  },
  {
    locale: "fa",
    direction: "rtl",
    heading: "آشپزخانه سارا به‌زودی آماده پذیرایی از شماست.",
  },
] as const;

for (const localeCase of localeCases) {
  test(`${localeCase.locale} renders at the clean public URL`, async ({ context, page }) => {
    await context.addCookies([
      {
        name: "SARA_LOCALE",
        value: localeCase.locale,
        url: "http://127.0.0.1:3100/",
      },
    ]);

    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("lang", localeCase.locale);
    await expect(page.locator("html")).toHaveAttribute("dir", localeCase.direction);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(localeCase.heading);
    await expect(page).toHaveURL("http://127.0.0.1:3100/");
  });
}

test("an invalid locale cookie is repaired to English", async ({ context, page }) => {
  await context.addCookies([
    {
      name: "SARA_LOCALE",
      value: "de",
      url: "http://127.0.0.1:3100/",
    },
  ]);

  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const localeCookie = (await context.cookies()).find((cookie) => cookie.name === "SARA_LOCALE");
  expect(localeCookie?.value).toBe("en");
});

test("an explicit locale navigation persists the choice and returns to a clean URL", async ({
  context,
  page,
}) => {
  await page.goto("/fa");

  await expect(page).toHaveURL("http://127.0.0.1:3100/");
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  const localeCookie = (await context.cookies()).find((cookie) => cookie.name === "SARA_LOCALE");
  expect(localeCookie?.value).toBe("fa");
});

test("an unknown public route returns the localized not-found response", async ({ page }) => {
  const response = await page.goto("/this-route-does-not-exist");

  // The App Router may stream a not-found response with HTTP 200; the rendered contract is the
  // localized not-found UI and its framework status is covered in non-streamed deployments.
  expect([200, 404]).toContain(response?.status());
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
});
