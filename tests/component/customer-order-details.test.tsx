import { ThemeProvider } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { CustomerOrderDetails } from "@/app/[locale]/(storefront)/profile/orders/[orderCode]/customer-order-details";
import { PROJECT_TIME_ZONE } from "@/constants";
import messages from "@/locales/messages/en";
import { appTheme } from "@/theme";
import type { CustomerOrderDetail } from "@/types/customer-order-detail";

vi.mock("@/locales/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ refresh: vi.fn() }),
}));

const order: CustomerOrderDetail = {
  code: "SK-1111-1111-1111-1111",
  status: "pending_payment",
  revision: 1,
  createdAt: "2026-10-14T10:00:00.000Z",
  currency: "EUR",
  customerName: "Sara Kazemi",
  notes: "No onions, please",
  address: null,
  items: [
    {
      slug: "fesenjan",
      name: "Fesenjan",
      quantity: 2,
      portionAmount: 1,
      portionUnit: "serving",
      baseUnitPriceCents: 1000,
      effectiveUnitPriceCents: 900,
      lineDiscountCents: 200,
      lineSubtotalCents: 1800,
    },
  ],
  pricing: {
    subtotalCents: 2000,
    discountCents: 200,
    deliveryFeeCents: 0,
    taxCents: 0,
    adjustmentsCents: 0,
    totalCents: 1800,
    freeDeliveryApplied: false,
  },
  fulfillment: {
    method: "pickup",
    leadTimeMinutes: 60,
    earliestReadyAt: "2026-10-14T11:00:00.000Z",
    completedAt: null,
  },
  paymentStatus: "pending",
  canCancel: false,
  canStartNewOrder: false,
  history: [
    { status: "pending_payment", paymentStatus: "pending", occurredAt: "2026-10-14T10:00:00.000Z" },
  ],
};

function renderDetail(value: CustomerOrderDetail = order) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
      <ThemeProvider theme={appTheme} defaultMode="light">
        <CustomerOrderDetails locale="en" order={value} />
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

describe("customer order detail", () => {
  it("shows immutable item, timing, pricing, and timeline facts", () => {
    renderDetail();
    expect(screen.getByRole("heading", { name: `Order ${order.code}` })).toBeInTheDocument();
    expect(screen.getByText("Fesenjan")).toBeInTheDocument();
    expect(screen.getByText("No onions, please", { exact: false })).toBeInTheDocument();
    expect(screen.getAllByText("€18.00")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Order timeline" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Check payment status" })).toHaveAttribute(
      "href",
      `/payment-result?order=${order.code}`,
    );
    expect(screen.queryByRole("button", { name: "Cancel order" })).not.toBeInTheDocument();
  });

  it("gates cancellation on provider state and offers contact/new-order recovery", async () => {
    const user = userEvent.setup();
    renderDetail({ ...order, paymentStatus: "cancelled", canCancel: true });
    expect(screen.getByRole("link", { name: "Contact the kitchen" })).toHaveAttribute(
      "href",
      "/contact",
    );
    await user.click(screen.getByRole("button", { name: "Cancel order" }));
    expect(screen.getByRole("dialog", { name: "Cancel this order?" })).toBeInTheDocument();
  });

  it("offers a new order after payment failure without claiming to retry the old charge", () => {
    renderDetail({
      ...order,
      status: "payment_failed",
      paymentStatus: "failed",
      canStartNewOrder: true,
    });
    expect(screen.getByRole("link", { name: "Start a new order" })).toHaveAttribute(
      "href",
      "/menu",
    );
    expect(screen.queryByRole("button", { name: "Cancel order" })).not.toBeInTheDocument();
  });
});
