import { ThemeProvider } from "@mui/material/styles";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CartStepTwo } from "@/app/[locale]/(storefront)/cart/address/cart-step-two";
import { PROJECT_TIME_ZONE } from "@/constants";
import type { CartContextValue } from "@/hooks/cart-context";
import messages from "@/locales/messages/en";
import { appTheme } from "@/theme";

const state = vi.hoisted(() => ({
  authenticated: true,
  cart: null as CartContextValue | null,
}));
vi.mock("@/hooks", () => ({
  useCart: () => state.cart,
  useCustomerAuth: () => ({ authenticated: state.authenticated, ready: true, displayName: null }),
}));
vi.mock("@/components/address", () => ({
  AddressEditor: () => <div>Address form with map</div>,
  DEFAULT_PORTO_POSITION: { latitude: 41.1579, longitude: -8.6291 },
  geoJsonPointFromLatLng: (latitude: number, longitude: number) => ({
    type: "Point",
    coordinates: [longitude, latitude],
  }),
}));

const DISH = "1".repeat(24);
const ADDRESS = "3".repeat(24);
const refresh = vi.fn(async () => undefined);

function cart(pickupConfirmed = false): CartContextValue {
  return {
    addItem: vi.fn(),
    cart: {
      id: "2".repeat(24),
      currency: "EUR",
      lines: [
        {
          dishId: DISH,
          quantity: 1,
          name: "Fesenjan",
          slug: "fesenjan",
          image: null,
          pricing: null,
          availability: null,
        },
      ],
      notes: null,
      pricing: {
        subtotalCents: 1_500,
        discountCents: 0,
        deliveryFeeCents: 0,
        taxCents: 0,
        adjustmentsCents: 0,
        totalCents: 1_500,
        calculatedAt: null,
      },
      pricingChanged: false,
      availability: { valid: true, orderLeadTimeMinutes: 60, earliestReadyAt: null },
      pickupConfirmed,
      selectedAddressId: null,
      version: 3,
    },
    clearCart: vi.fn(),
    clearError: vi.fn(),
    error: null,
    itemCount: 1,
    pendingDishIds: new Set(),
    refresh,
    removeItem: vi.fn(),
    setNotes: vi.fn(),
    status: "ready",
    updateQuantity: vi.fn(),
  };
}

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
      <ThemeProvider theme={appTheme} defaultMode="light">
        <CartStepTwo />
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  state.authenticated = true;
  state.cart = cart();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })),
  );
});

describe("cart step two", () => {
  it("gates customer addresses behind sign-in", () => {
    state.authenticated = false;
    renderPage();
    expect(screen.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Add address" })).not.toBeInTheDocument();
  });

  it("blocks review until pickup is explicitly saved", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByRole("button", { name: "Continue to review" })).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: /Pickup/u }));
    expect(fetch).toHaveBeenCalledWith(
      "/api/cart",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ expectedVersion: 3, fulfillment: { method: "pickup" } }),
      }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("shows saved addresses and submits selection without accepting client prices", async () => {
    const address = {
      id: ADDRESS,
      name: "Home",
      recipientName: "Sara",
      recipientMobile: "+351912345678",
      formattedAddress: "Rua das Flores 10, Porto",
      postalCode: "4000-001",
      location: { type: "Point", coordinates: [-8.6291, 41.1579] },
      isDefault: true,
      deliveryNotes: null,
      version: 1,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (input: RequestInfo | URL) =>
          new Response(
            JSON.stringify({ data: String(input).includes("addresses") ? [address] : {} }),
            { status: 200 },
          ),
      ),
    );
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "Deliver to Home" })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("radio", { name: "Deliver to Home" }));
    expect(fetch).toHaveBeenCalledWith(
      "/api/cart",
      expect.objectContaining({
        body: JSON.stringify({
          expectedVersion: 3,
          fulfillment: { method: "delivery", addressId: ADDRESS },
        }),
      }),
    );
  });
});
