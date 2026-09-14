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
