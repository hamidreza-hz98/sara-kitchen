import { expect, test } from "@playwright/test";

test("the sitemap exposes only successful canonical public pages", async ({ page, request }) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()["content-type"]).toContain("application/xml");
  const xml = await sitemap.text();
  expect(xml).toContain("http://www.sitemaps.org/schemas/sitemap/0.9");
  expect(xml).not.toMatch(/\/(?:dashboard|authentication|profile|cart|payment-result)(?:\/|<)/u);

  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => match[1]!);
  expect(urls.length).toBeGreaterThan(0);
  for (const url of urls) {
    // Exercise the configured Playwright server while retaining the production-style canonical
    // host carried by the sitemap fixture.
    const response = await page.goto(new URL(url).pathname);
    expect(response?.status(), url).toBe(200);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", url);
  }
});
