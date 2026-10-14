import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("mobile order review remains usable and does not submit before checkout opens", async ({
  page,
}) => {
  const cart = {
    id: "1".repeat(24),
    currency: "EUR",
    version: 3,
    pickupConfirmed: true,
    selectedAddressId: null,
    lines: [
      {
        dishId: "2".repeat(24),
        quantity: 1,
        name: "Fesenjan",
        slug: "fesenjan",
        image: null,
        pricing: {
          baseUnitPriceCents: 1200,
          effectiveUnitPriceCents: 1200,
          lineDiscountCents: 0,
          lineSubtotalCents: 1200,
        },
        availability: {
          available: true,
          issueCodes: [],
          leadTimeMinutes: 60,
          maxAllowedQuantity: 10,
        },
      },
    ],
    notes: null,
    pricing: {
      subtotalCents: 1200,
      discountCents: 0,
      deliveryFeeCents: 0,
      taxCents: 0,
      adjustmentsCents: 0,
      totalCents: 1200,
      calculatedAt: null,
    },
    pricingChanged: false,
    availability: { valid: true, earliestReadyAt: null, orderLeadTimeMinutes: 60 },
  };
  await page.route("**/api/auth/customer/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { authenticated: true, displayName: "Sara" } }),
    }),
  );
  await page.route("**/api/cart", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: cart }),
    }),
  );
  await page.route("**/api/checkout/review", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          cart,
          address: null,
          policies: [],
          paymentMethods: [{ type: "mbway", enabled: false }],
          submissionAvailable: false,
        },
      }),
    }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cart/review");
  await expect(page.getByRole("heading", { name: "Review your order", level: 1 })).toBeVisible();
  await expect(page.getByText("Fesenjan")).toBeVisible();
  await expect(page.getByRole("button", { name: "Place order and pay" })).toBeDisabled();
  const widths = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
  const scan = await new AxeBuilder({ page }).analyze();
  expect(scan.violations).toEqual([]);
});
