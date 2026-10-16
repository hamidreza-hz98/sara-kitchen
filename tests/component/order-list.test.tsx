import { ThemeProvider } from "@mui/material/styles";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OrderList } from "@/app/[locale]/(dashboard)/dashboard/orders/order-list";
import { PROJECT_TIME_ZONE } from "@/constants";
import messages from "@/locales/messages/en";
import { FeedbackProvider } from "@/providers/feedback-provider";
import { appTheme } from "@/theme";

const navigation = vi.hoisted(() => ({ query: "", replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.query),
}));
vi.mock("@/locales/navigation", () => ({
  usePathname: () => "/dashboard/orders",
  useRouter: () => ({ replace: navigation.replace, push: navigation.push }),
}));
vi.mock("@/lib/csrf-client", () => ({
  csrfJsonHeaders: async () => ({ "content-type": "application/json" }),
}));

const order = {
  id: "507f1f77bcf86cd799439011",
  code: "SK-1234-5678-9ABC-DEFG",
  status: "confirmed",
  revision: 2,
  customer: { firstName: "Sara", lastName: "Kazemi", mobile: "+351912345678" },
  items: [{ name: "Fesenjan", quantity: 2, lineSubtotalCents: 1800 }],
  pricing: { totalCents: 1800, subtotalCents: 1800, deliveryFeeCents: 0 },
  fulfillment: { method: "pickup" },
  statusHistory: [{ paymentStatus: "paid" }],
  createdAt: "2026-10-14T12:00:00.000Z",
};

function listResponse() {
  return new Response(
    JSON.stringify({
      data: [order],
      meta: {
        pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
        summary: {
          statusCounts: {
            pending_payment: 0,
            confirmed: 1,
            preparing: 0,
            ready: 0,
            out_for_delivery: 0,
            completed: 0,
            payment_failed: 0,
            cancelled: 0,
            expired: 0,
            refunded: 0,
          },
          allCount: 1,
          allAmountCents: 1800,
        },
      },
    }),
    { status: 200 },
  );
}

function renderList(capabilities = { readSensitive: true, update: true, cancel: true }) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
      <ThemeProvider theme={appTheme} defaultMode="light">
        <FeedbackProvider>
          <OrderList capabilities={capabilities} />
        </FeedbackProvider>
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  navigation.query = "";
  navigation.replace.mockReset();
  navigation.push.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => listResponse()),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("dashboard order list", () => {
  it("shows consistent counts and writes selected status to the URL", async () => {
    const user = userEvent.setup();
    renderList();
    expect((await screen.findAllByText("€18.00")).length).toBeGreaterThan(0);
    expect(screen.getByRole("tab", { name: "Confirmed (1)" })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Confirmed (1)" }));
    expect(navigation.replace).toHaveBeenCalledWith("/dashboard/orders?status=confirmed&page=1", {
      scroll: false,
    });
  });

  it("preserves shareable filters in its request", async () => {
    navigation.query =
      "status=confirmed&paymentStatus=paid&from=2026-10-01&to=2026-10-15&sort=totalCents%3Aasc&page=2";
    renderList();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const request = String(vi.mocked(fetch).mock.calls[0]?.[0]);
    expect(request).toContain("status=confirmed");
    expect(request).toContain("paymentStatus=paid");
    expect(request).toContain("sortBy=totalCents");
    expect(request).toContain("page=2");
  });

  it("keeps the loaded list visible when opening an order summary", async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findAllByText(order.code);
    await user.click(screen.getAllByRole("button", { name: order.code })[0]!);
    expect(navigation.replace).toHaveBeenCalledWith(`/dashboard/orders?order=${order.code}`, {
      scroll: false,
    });
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("hides sensitive search and mutation actions without permissions", async () => {
    const user = userEvent.setup();
    renderList({ readSensitive: false, update: false, cancel: false });
    await screen.findAllByText(order.code);
    expect(screen.queryByText("Sara Kazemi")).not.toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: `Actions: ${order.code}` })[0]!);
    const menu = screen.getByRole("menu");
    expect(within(menu).queryByText("Cancel order")).not.toBeInTheDocument();
    expect(within(menu).queryByText("Preparing")).not.toBeInTheDocument();
  });

  it("requires confirmation before cancelling", async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findAllByText(order.code);
    await user.click(screen.getAllByRole("button", { name: `Actions: ${order.code}` })[0]!);
    await user.click(screen.getByRole("menuitem", { name: "Cancel order" }));
    expect(vi.mocked(fetch).mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
    const dialog = screen.getByRole("dialog", { name: "Cancel this order?" });
    await user.click(within(dialog).getByRole("button", { name: "Confirm cancellation" }));
    await waitFor(() =>
      expect(vi.mocked(fetch).mock.calls.some(([, init]) => init?.method === "POST")).toBe(true),
    );
  });

  it("opens the full details route from the action menu", async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findAllByText(order.code);
    await user.click(screen.getAllByRole("button", { name: `Actions: ${order.code}` })[0]!);
    await user.click(screen.getByRole("menuitem", { name: "Open full details" }));
    expect(navigation.push).toHaveBeenCalledWith(`/dashboard/orders/${order.code}`);
  });
});
