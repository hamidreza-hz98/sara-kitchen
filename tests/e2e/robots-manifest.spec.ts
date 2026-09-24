import { expect, test } from "@playwright/test";

test("development robots policy blocks crawling and omits production discovery", async ({
  request,
}) => {
  const response = await request.get("/robots.txt");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/plain");

  const body = await response.text();
  expect(body).toContain("User-Agent: *");
  expect(body).toContain("Disallow: /");
  expect(body).not.toContain("Sitemap:");
  expect(body).not.toContain("Host:");
});

test("manifest follows the persisted locale and exposes valid brand icons", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest", {
    headers: { cookie: "SARA_LOCALE=fa" },
  });
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/manifest+json");

  const manifest = (await response.json()) as {
    dir: string;
    icons: { purpose?: string; src: string }[];
    lang: string;
    name: string;
    scope: string;
    start_url: string;
  };
  expect(manifest).toMatchObject({ lang: "fa", dir: "rtl", scope: "/", start_url: "/" });
  expect(manifest.name).toContain("آشپزخانه سارا");

  for (const icon of manifest.icons) {
    const iconResponse = await request.get(icon.src);
    expect(iconResponse.status()).toBe(200);
    expect(iconResponse.headers()["content-type"]).toContain("image/png");
  }
});
