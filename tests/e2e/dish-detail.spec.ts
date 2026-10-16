import { expect, test } from "@playwright/test";

test("unknown and inactive dish slugs do not expose a public detail page", async ({
  request,
  page,
}) => {
  const response = await request.get("/menu/this-dish-does-not-exist-zzzz");
  // App Router may stream a not-found page with HTTP 200 after headers are sent.
  expect([200, 404]).toContain(response.status());
  const html = await response.text();
  expect(html).toContain("This dish is no longer available");
  expect(html).toMatch(/<meta[^>]+name="robots"[^>]+content="noindex"/u);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/menu/this-dish-does-not-exist-zzzz");
  await expect(
    page.getByRole("heading", { name: "This dish is no longer available" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse menu" })).toHaveAttribute("href", "/menu");
  await expect(page.getByRole("button", { name: "Add to cart" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
