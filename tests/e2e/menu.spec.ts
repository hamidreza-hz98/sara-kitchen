import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("the menu is server-rendered, shareable, and keyboard accessible", async ({
  page,
  request,
}) => {
  const response = await request.get("/menu?sort=newest&view=list");
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain("Our menu");
  expect(html).toContain('name="category"');
  expect(html).toContain('name="sort"');

  await page.goto("/menu?sort=newest&view=list");
  await expect(page.getByRole("heading", { level: 1, name: "Our menu" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Sort by" })).toHaveValue("newest");
  await expect(page.getByRole("link", { name: "List" })).toHaveAttribute("aria-current", "page");
  await page.getByText("More filters").click();
  await expect(page.getByRole("checkbox", { name: "Vegetarian" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("the mobile menu fits the viewport and keeps its filters usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/menu");
  await expect(page.getByRole("heading", { level: 1, name: "Our menu" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search dishes" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
