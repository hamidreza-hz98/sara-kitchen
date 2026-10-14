import { ThemeProvider } from "@mui/material/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReviewBridge } from "@/app/[locale]/(storefront)/cart/review/review-bridge";
import { PROJECT_TIME_ZONE } from "@/constants";
import type { CheckoutReviewData } from "@/lib/checkout-client";
import messages from "@/locales/messages/en";
import { appTheme } from "@/theme";

const state = vi.hoisted(() => ({
  authenticated: true,
  push: vi.fn(),
  refresh: vi.fn(async () => undefined),
}));
vi.mock("@/hooks", () => ({
  useCustomerAuth: () => ({ ready: true, authenticated: state.authenticated }),
  useCart: () => ({ cart: { version: 3 }, refresh: state.refresh }),
}));
vi.mock("@/locales/navigation", () => ({ useRouter: () => ({ push: state.push }) }));

const policy = (documentType: "terms-of-service" | "privacy-policy") => ({
  id: documentType === "terms-of-service" ? "3".repeat(24) : "4".repeat(24),
  documentType,
  version: 1,
  title: documentType === "terms-of-service" ? "Terms" : "Privacy",
  summary: "Published policy",
  sections: [],
});
const review: CheckoutReviewData = {
  cart: {
    id: "1".repeat(24),
    currency: "EUR",
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
    pickupConfirmed: true,
    selectedAddressId: null,
    version: 3,
  },
  address: null,
  policies: [policy("terms-of-service"), policy("privacy-policy")],
  paymentMethods: [{ type: "mbway", enabled: false }],
  submissionAvailable: false,
};

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
      <ThemeProvider theme={appTheme} defaultMode="light">
        <ReviewBridge />
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  state.authenticated = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ data: review }), { status: 200 })),
  );
});

describe("cart step three", () => {
  it("gates anonymous review", () => {
    state.authenticated = false;
    renderPage();
    expect(screen.getByText("Sign in before reviewing your order.")).toBeVisible();
  });

  it("renders the authoritative review and keeps payment locked before provider activation", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Fesenjan")).toBeVisible());
    expect(screen.getByText("Pickup at Sara Kitchen")).toBeVisible();
    expect(screen.getAllByText("€12.00").length).toBeGreaterThan(1);
    await user.click(screen.getByRole("radio", { name: "MB Way" }));
    await user.type(screen.getByRole("textbox", { name: "MB Way mobile number" }), "+351912345678");
    await user.click(
      screen.getByRole("checkbox", { name: "I accept the current terms of service." }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: "I accept the current privacy policy." }),
    );
    expect(screen.getByRole("button", { name: "Place order and pay" })).toBeDisabled();
    expect(fetch).not.toHaveBeenCalledWith("/api/checkout", expect.anything());
  });

  it("holds one in-flight submission even under rapid duplicate clicks", async () => {
    const enabled = {
      ...review,
      paymentMethods: [{ type: "mbway", enabled: true }],
      submissionAvailable: true,
    };
    let release!: (value: Response) => void;
    const submission = new Promise<Response>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).includes("/api/checkout/review")
          ? new Response(JSON.stringify({ data: enabled }), { status: 200 })
          : submission,
      ),
    );
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Fesenjan")).toBeVisible());
    await user.click(screen.getByRole("radio", { name: "MB Way" }));
    await user.type(screen.getByRole("textbox", { name: "MB Way mobile number" }), "+351912345678");
    await user.click(
      screen.getByRole("checkbox", { name: "I accept the current terms of service." }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: "I accept the current privacy policy." }),
    );
    const button = screen.getByRole("button", { name: "Place order and pay" });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() =>
      expect(
        vi.mocked(fetch).mock.calls.filter(([input]) => input === "/api/checkout"),
      ).toHaveLength(1),
    );
    expect(screen.getByRole("button", { name: "Submitting…" })).toBeDisabled();
    release(new Response(JSON.stringify({ ok: false }), { status: 409 }));
    await waitFor(() =>
      expect(screen.getByText(/The cart, address, or price changed/u)).toBeVisible(),
    );
  });
});
