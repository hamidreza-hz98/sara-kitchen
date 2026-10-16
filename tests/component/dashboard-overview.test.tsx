import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DashboardOverview } from "@/app/[locale]/(dashboard)/dashboard/dashboard-overview";
import messages from "@/locales/messages/en/dashboard.json";

const snapshot = {
  freshness: { generatedAt: "2026-10-16T12:00:00.000Z", viewPeriodComplete: false },
  totals: {
    grossSalesCents: 12_000,
    refundsCents: 2_000,
    netSalesCents: 10_000,
    registeredCustomers: 3,
    ordersCreated: 4,
    publishedDishes: 5,
    paidOrders: 2,
    averageOrderValueCents: 6_000,
  },
  comparison: { netSalesChangePercent: 25, registeredCustomers: 2, ordersCreated: 2 },
  orderStatusCounts: {
    awaitingPayment: 1,
    paidActive: 2,
    completed: 1,
    unsuccessful: 0,
    cancelled: 0,
    refunded: 0,
  },
  salesChart: [
    { date: "2026-10-15", grossCents: 4_000, refundsCents: 500, netCents: 3_500 },
    { date: "2026-10-16", grossCents: 8_000, refundsCents: 1_500, netCents: 6_500 },
  ],
  recentOrders: [
    {
      code: "SK-0001",
      status: "confirmed",
      totalCents: 6_000,
      createdAt: new Date("2026-10-16T11:00:00Z"),
    },
  ],
  topSellingDishes: [{ dishId: "dish-1", name: "Fesenjan", netUnits: 4 }],
  mostVisitedDishes: { items: [{ dishId: "dish-1", name: "Fesenjan", views: 20 }] },
  bestCustomers: [{ customerId: "customer-1", displayName: "Sara A", netCents: 6_000 }],
  recentActivity: [
    { id: "event-1", message: "Order received", occurredAt: "2026-10-16T11:00:00Z" },
  ],
};

const labels = { ...messages.overview, orderStatuses: messages.orderList.statuses };
const selection = {
  range: "month" as const,
  orderTab: "all" as const,
  startDate: "2026-09-17",
  endDate: "2026-10-16",
};

describe("dashboard overview", () => {
  it("uses authoritative totals, exposes chart values to assistive technology, and shows the snapshot time", () => {
    render(
      <DashboardOverview
        snapshot={snapshot as never}
        selection={selection}
        locale="en"
        labels={labels}
        permissions={["dishes:create", "orders:read", "logs:read"]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Dashboard overview" })).toBeInTheDocument();
    expect(screen.getAllByText("€100.00").length).toBeGreaterThan(0);
    expect(screen.getByText("€20.00")).toBeInTheDocument();
    expect(screen.getByText("SK-0001")).toBeInTheDocument();
    expect(screen.getByText(/Data as of/)).toBeInTheDocument();
    const chart = screen.getByRole("list", { name: /Sales trends: Gross sales/ });
    expect(
      within(chart).getByText(/2026-10-16: Gross sales €80.00, Refunds €15.00, Net sales €65.00/),
    ).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Recent orders" })).toBeInTheDocument();
  });

  it("renders useful empty states and hides unauthorized shortcuts and activity", () => {
    render(
      <DashboardOverview
        snapshot={
          {
            ...snapshot,
            salesChart: [],
            recentOrders: [],
            topSellingDishes: [],
            bestCustomers: [],
            recentActivity: [],
            mostVisitedDishes: { items: [] },
          } as never
        }
        selection={selection}
        locale="en"
        labels={labels}
        permissions={[]}
      />,
    );
    expect(screen.getByText("No sales in this period yet.")).toBeInTheDocument();
    expect(screen.getByText("No recent orders in this group.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Recent activity" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "New dish" })).not.toBeInTheDocument();
  });
});
