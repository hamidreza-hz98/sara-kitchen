import { ThemeProvider } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CartStepOne } from "@/app/[locale]/(storefront)/cart/cart-step-one";
import { PROJECT_TIME_ZONE } from "@/constants";
import type { CartContextValue } from "@/hooks/cart-context";
import { CartClientError } from "@/lib/cart-client";
import messages from "@/locales/messages/en";
import { appTheme } from "@/theme";

const state = vi.hoisted(() => ({ value: null as CartContextValue | null }));
vi.mock("@/hooks", () => ({ useCart: () => state.value }));

const DISH = "1".repeat(24);
const operations = {
  addItem: vi.fn(async () => undefined),
  clearCart: vi.fn(async () => undefined),
  clearError: vi.fn(),
  refresh: vi.fn(async () => undefined),
  removeItem: vi.fn(async () => undefined),
  setNotes: vi.fn(async () => undefined),
  updateQuantity: vi.fn(async () => undefined),
};

function cartValue(overrides: Partial<CartContextValue> = {}): CartContextValue {
  return {
    ...operations,
    cart: null,
    error: null,
    itemCount: 0,
    pendingDishIds: new Set(),
    status: "ready",
    ...overrides,
  };
}

function populatedCart(unavailable = false) {
  return {
    availability: {
      earliestReadyAt: "2026-10-13T13:00:00.000Z",
      orderLeadTimeMinutes: 60,
      valid: !unavailable,
    },
    currency: "EUR" as const,
    id: "2".repeat(24),
    lines: [
      {
        availability: {
          available: !unavailable,
          issueCodes: unavailable ? ["dish_unavailable"] : [],
          leadTimeMinutes: 60,
          maxAllowedQuantity: 5,
        },
        dishId: DISH,
        image: null,
        name: "Fesenjan",
        pricing: {
          baseUnitPriceCents: 1_400,
          effectiveUnitPriceCents: 1_200,
          lineDiscountCents: 400,
          lineSubtotalCents: 2_400,
        },
        quantity: 2,
        slug: "fesenjan",
      },
    ],
    notes: "No cutlery",
    pricing: {
      adjustmentsCents: 0,
      calculatedAt: "2026-10-13T12:00:00.000Z",
      deliveryFeeCents: 0,
      discountCents: 400,
      subtotalCents: 2_800,
      taxCents: 0,
      totalCents: 2_400,
    },
    pricingChanged: true,
    selectedAddressId: null,
    version: 3,
  };
}

function renderPage() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ data: { items: [] } }), { status: 200 })),
  );
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
      <ThemeProvider theme={appTheme} defaultMode="light">
        <CartStepOne />
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  state.value = cartValue();
});

describe("cart step one", () => {
  it("renders loading, empty, and unrecoverable failure states", () => {
    state.value = cartValue({ status: "loading" });
    const view = renderPage();
    expect(screen.getByLabelText("Loading cart")).toBeVisible();
    view.unmount();

    state.value = cartValue();
    const emptyView = renderPage();
    expect(screen.getByRole("heading", { name: "Your cart is empty." })).toBeVisible();
    emptyView.unmount();

    state.value = cartValue({ error: new CartClientError("network"), status: "error" });
    renderPage();
    expect(screen.getByRole("heading", { name: "We couldn't load your cart" })).toBeVisible();
  });

  it("shows current server totals, stale-price guidance, and line availability", () => {
    state.value = cartValue({ cart: populatedCart(true), itemCount: 2 });
    renderPage();
    expect(screen.getByText("Fesenjan")).toBeVisible();
    expect(screen.getByText(/Prices changed since/)).toBeVisible();
    expect(screen.getByText("This dish is temporarily unavailable.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Continue to address" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("uses the shared adapter for quantity, notes, remove, and clear", async () => {
    const user = userEvent.setup();
    state.value = cartValue({ cart: populatedCart(), itemCount: 2 });
    renderPage();
    expect(screen.getByText("Fesenjan quantity: 2")).toHaveAttribute("aria-live", "polite");
    await user.click(screen.getByRole("button", { name: "Increase Fesenjan quantity" }));
    expect(operations.updateQuantity).toHaveBeenCalledWith(DISH, 3);

    const notes = screen.getByRole("textbox", { name: "Order notes" });
    await user.clear(notes);
    await user.type(notes, "Ring the bell");
    await user.click(screen.getByRole("button", { name: "Save note" }));
    expect(operations.setNotes).toHaveBeenCalledWith("Ring the bell");

    await user.click(screen.getByRole("button", { name: "Remove Fesenjan" }));
    expect(operations.removeItem).toHaveBeenCalledWith(DISH);

    await user.click(screen.getByRole("button", { name: "Clear cart" }));
    await user.click(screen.getByRole("button", { name: "Clear cart" }));
    expect(operations.clearCart).toHaveBeenCalledOnce();
  });
});
