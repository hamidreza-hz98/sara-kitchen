import { ThemeProvider } from "@mui/material/styles";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  OrderDetails,
  type DetailOrder,
  type DetailTransaction,
} from "@/app/[locale]/(dashboard)/dashboard/orders/[orderCode]/order-details";
import { PROJECT_TIME_ZONE } from "@/constants";
import messages from "@/locales/messages/en";
import { FeedbackProvider } from "@/providers/feedback-provider";
import { appTheme } from "@/theme";

vi.mock("@/locales/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/csrf-client", () => ({
  csrfJsonHeaders: async () => ({ "content-type": "application/json" }),
}));

const order: DetailOrder = {
  id: "507f1f77bcf86cd799439011",
  code: "SK-1234-5678-9ABC-DEFG",
  status: "confirmed",
  revision: 2,
  managementRevision: 0,
  customerId: "507f1f77bcf86cd799439013",
  customer: { firstName: "Sara", lastName: "Kazemi", mobile: "+351912345678", email: null },
  address: {
    name: "Home",
    recipientName: "Sara Kazemi",
    recipientMobile: "+351912345678",
    formattedAddress: "Rua Teste 1, Porto",
    postalCode: "4000-001",
    deliveryNotes: null,
    location: { coordinates: [-8.6, 41.1] },
  },
  items: [
    {
      dishId: "507f1f77bcf86cd799439014",
      slug: "fesenjan",
      name: "Fesenjan",
      quantity: 2,
      baseUnitPriceCents: 1200,
      effectiveUnitPriceCents: 1000,
      lineSubtotalCents: 2000,
    },
  ],
  pricing: {
    subtotalCents: 2400,
    discountCents: 400,
    deliveryFeeCents: 0,
    taxCents: 0,
    adjustmentsCents: 0,
    totalCents: 2000,
    adjustments: [],
  },
  fulfillment: {
    method: "delivery",
    leadTimeMinutes: 1440,
    acceptedAt: "2026-10-14T12:00:00.000Z",
    earliestReadyAt: "2026-10-15T12:00:00.000Z",
    completedAt: null,
  },
  statusHistory: [
    {
      status: "pending_payment",
      actorKind: "system",
      paymentStatus: "pending",
      reasonCode: null,
      occurredAt: "2026-10-14T12:00:00.000Z",
    },
    {
      status: "confirmed",
      actorKind: "system",
      paymentStatus: "paid",
      reasonCode: null,
      occurredAt: "2026-10-14T12:05:00.000Z",
    },
  ],
  transactionIds: ["507f1f77bcf86cd799439012"],
  notes: "No nuts please",
  internalNote: null,
  refundFollowUpRequired: false,
  createdAt: "2026-10-14T12:00:00.000Z",
  updatedAt: "2026-10-14T12:05:00.000Z",
};

const transaction: DetailTransaction = {
  id: order.transactionIds[0]!,
  orderId: order.id,
  method: "mbway",
  provider: "mbway-sandbox",
  status: "paid",
  amounts: { requestedCents: 2000, authorizedCents: 2000, capturedCents: 2000, refundedCents: 0 },
  responseCode: null,
  events: [
    {
      status: "paid",
      source: "provider",
      amountCents: 2000,
      responseCode: null,
      occurredAt: "2026-10-14T12:05:00.000Z",
    },
  ],
  createdAt: "2026-10-14T12:00:00.000Z",
};

function renderDetails(
  capabilities = { readSensitive: true, readTransactions: true, update: true, cancel: true },
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
      <ThemeProvider theme={appTheme} defaultMode="light">
        <FeedbackProvider>
          <OrderDetails
            initialOrder={order}
            initialTransactions={[transaction]}
            capabilities={capabilities}
          />
        </FeedbackProvider>
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

describe("order details dashboard", () => {
  it("shows immutable snapshots, timeline, prices, and payment events", () => {
    renderDetails();
    expect(screen.getByRole("heading", { name: `Order ${order.code}` })).toBeInTheDocument();
    expect(screen.getByText("Fesenjan")).toBeInTheDocument();
    expect(screen.getByText("Rua Teste 1, Porto")).toBeInTheDocument();
    expect(screen.getByText("No nuts please")).toBeInTheDocument();
    expect(screen.getByText("mbway · mbway-sandbox")).toBeInTheDocument();
    expect(screen.getByRole("list").children).toHaveLength(2);
  });

  it("hides PII, transaction events, and actions without permissions", () => {
    renderDetails({ readSensitive: false, readTransactions: false, update: false, cancel: false });
    expect(screen.queryByText("Rua Teste 1, Porto")).not.toBeInTheDocument();
    expect(screen.queryByText("No nuts please")).not.toBeInTheDocument();
    expect(screen.queryByText("mbway · mbway-sandbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Move to/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel order" })).not.toBeInTheDocument();
  });

  it("requires confirmation before a valid next status action", async () => {
    const user = userEvent.setup();
    renderDetails();
    await user.click(screen.getByRole("button", { name: "Move to Preparing" }));
    expect(fetch).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "Confirm status change?" });
    expect(
      within(dialog).getByText("This change will be recorded in the order timeline."),
    ).toBeInTheDocument();
  });
});
