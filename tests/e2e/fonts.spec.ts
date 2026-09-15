import { expect, test } from "@playwright/test";

test("local Latin and Persian fonts load without a font-driven layout shift", async ({
  page,
  request,
}) => {
  await page.addInitScript(() => {
    const telemetry = window as typeof window & { __saraCumulativeLayoutShift?: number };
    telemetry.__saraCumulativeLayoutShift = 0;

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
        if (!shift.hadRecentInput) {
          telemetry.__saraCumulativeLayoutShift =
            (telemetry.__saraCumulativeLayoutShift ?? 0) + shift.value;
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  });

  const response = await request.get("/theme-showcase");
  expect(response.ok()).toBe(true);
  const serverHtml = await response.text();
  expect(serverHtml).not.toContain("fonts.googleapis.com");
  expect(serverHtml).not.toContain("fonts.gstatic.com");

  await page.goto("/theme-showcase");
  await expect(page.getByTestId("theme-showcase")).toHaveAttribute("data-hydrated", "true");

  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });

  const persianSample = page.getByTestId("persian-font-sample");
  const fontEvidence = await persianSample.evaluate((element) => {
    const style = getComputedStyle(element);
    const rootStyle = getComputedStyle(document.documentElement);
    const persianFamily = rootStyle.getPropertyValue("--font-sara-persian").trim();
    const normalizeFamily = (family: string) =>
      family.replaceAll('"', "").replaceAll("'", "").trim();
    const primaryPersianFamily = normalizeFamily(persianFamily.split(",")[0] ?? "");

    return {
      activeFamily: style.getPropertyValue("--font-sara-active").trim(),
      family: style.fontFamily,
      faceLoaded: [...document.fonts].some(
        (face) => normalizeFamily(face.family) === primaryPersianFamily && face.status === "loaded",
      ),
      primaryPersianFamily,
      persianFamily,
      direction: style.direction,
    };
  });

  expect(fontEvidence.faceLoaded).toBe(true);
  expect(fontEvidence.direction).toBe("rtl");
  expect(fontEvidence.activeFamily).toBe(fontEvidence.persianFamily);
  expect(fontEvidence.family).toMatch(
    new RegExp(`^"?${fontEvidence.primaryPersianFamily.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}`),
  );
  await test.info().attach("persian-font-sample", {
    body: await persianSample.screenshot(),
    contentType: "image/png",
  });

  const fontResources = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => /\.(?:woff2|woff|ttf)(?:\?|$)/u.test(name)),
  );

  expect(fontResources.length).toBeGreaterThanOrEqual(2);
  for (const resource of fontResources) {
    const url = new URL(resource);
    expect(url.origin).toBe("http://127.0.0.1:3100");
    expect(url.pathname).toContain("/_next/static/media/");
  }

  const cumulativeLayoutShift = await page.evaluate(
    () =>
      (window as typeof window & { __saraCumulativeLayoutShift?: number })
        .__saraCumulativeLayoutShift ?? 0,
  );
  expect(cumulativeLayoutShift).toBeLessThan(0.001);
});
