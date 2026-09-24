import { expect, test } from "@playwright/test";

test("the homepage renders localized discovery metadata at the clean public URL", async ({
  context,
  page,
}) => {
  await context.addCookies([
    { name: "SARA_LOCALE", value: "pt-PT", url: "http://127.0.0.1:3100/" },
  ]);
  await page.goto("/");

  await expect(page).toHaveTitle("Sara Kitchen");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "Comida persa caseira no Porto, Portugal.",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "http://localhost:3000",
  );
  await expect(page.locator('link[rel="alternate"][hreflang="pt-PT"]')).toHaveAttribute(
    "href",
    "http://localhost:3000",
  );
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "pt_PT");
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
  );
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", /\/favicon\.ico/);
  await expect(page.locator('link[rel="shortcut icon"]')).toHaveAttribute("href", "/favicon.ico");

  const jsonLd = page.locator('script[type="application/ld+json"]');
  await expect(jsonLd).toHaveCount(1);
  const graph = JSON.parse((await jsonLd.textContent()) ?? "null") as {
    "@context": string;
    "@graph": Array<{ "@type": string; inLanguage?: string }>;
  };
  expect(graph["@context"]).toBe("https://schema.org");
  expect(graph["@graph"]).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ "@type": "WebPage", inLanguage: "pt-PT" }),
      expect.objectContaining({ "@type": "WebSite" }),
      expect.objectContaining({ "@type": "Organization" }),
    ]),
  );
});
