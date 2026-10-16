import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("the homepage renders without automatically detectable accessibility violations", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const accessibilityScan = await new AxeBuilder({ page }).analyze();

  expect(accessibilityScan.violations).toEqual([]);
});

test("the mobile homepage keeps its hero and menu action usable without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore the menu" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("MUI styles stream before content and hydrate without duplicates", async ({
  page,
  request,
}) => {
  const runtimeErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      runtimeErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  const serverResponse = await request.get("/");
  expect(serverResponse.ok()).toBe(true);

  const serverHtml = await serverResponse.text();
  const heroIndex = serverHtml.indexOf('aria-label="Featured stories"');
  const serverStyleTags = [
    ...serverHtml.matchAll(/<style[^>]+data-emotion="sara-mui[^"]*"[^>]*>/g),
  ];

  expect(serverStyleTags.length).toBeGreaterThan(0);
  expect(serverHtml).toContain("@layer mui");
  expect(heroIndex).toBeGreaterThan(0);
  for (const styleTag of serverStyleTags) {
    // Next may stream page-specific Emotion CSS after </head>, but before the page it styles.
    expect(styleTag.index).toBeLessThan(heroIndex);
  }

  await page.goto("/");
  await expect(page.getByRole("link", { name: "Explore the menu" })).toHaveClass(/MuiButton-root/);

  const emotionIdentifiers = await page
    .locator('head style[data-emotion^="sara-mui"]')
    .evaluateAll((styleTags) =>
      styleTags.flatMap((styleTag) =>
        (styleTag.getAttribute("data-emotion") ?? "").split(/\s+/).slice(1),
      ),
    );

  expect(emotionIdentifiers.length).toBeGreaterThan(0);
  expect(new Set(emotionIdentifiers).size).toBe(emotionIdentifiers.length);
  await expect(page.locator('body style[data-emotion^="sara-mui"]')).toHaveCount(0);

  await page.reload();

  const identifiersAfterReload = await page
    .locator('head style[data-emotion^="sara-mui"]')
    .evaluateAll((styleTags) =>
      styleTags.flatMap((styleTag) =>
        (styleTag.getAttribute("data-emotion") ?? "").split(/\s+/).slice(1),
      ),
    );

  expect(new Set(identifiersAfterReload).size).toBe(identifiersAfterReload.length);
  expect(identifiersAfterReload).toEqual(expect.arrayContaining(emotionIdentifiers));
  expect(runtimeErrors).toEqual([]);
});
