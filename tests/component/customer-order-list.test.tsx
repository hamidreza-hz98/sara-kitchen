import { ThemeProvider } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CustomerOrderList } from "@/app/[locale]/(storefront)/profile/orders/customer-order-list";
import { PROJECT_TIME_ZONE } from "@/constants";
import messages from "@/locales/messages/en";
import { appTheme } from "@/theme";
import type { CustomerOrderListResult } from "@/types/customer-order";

const push = vi.fn();
vi.mock("@/locales/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));

const code = "SK-1111-1111-1111-1111";
const page: CustomerOrderListResult = {
  items: [
    {
      code,
      status: "confirmed",
      createdAt: "2026-10-01T10:00:00.000Z",
      totalCents: 2250,
      fulfillmentMethod: "delivery",
      itemCount: 2,
      items: [{ name: "Kebab", quantity: 2 }],
    },
  ],
  page: 1,
  pageSize: 8,
  total: 9,
  totalPages: 2,
  counts: { all: 9, active: 4, completed: 3, closed: 2 },
};

function renderList(value: CustomerOrderListResult = page) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
      <ThemeProvider theme={appTheme} defaultMode="light">
        <CustomerOrderList locale="en" page={value} tab="all" status={null} />
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => push.mockReset());

describe("customer order list", () => {
  it("renders purchase snapshot, status, total and a working detail link", () => {
    renderList();
    expect(screen.getByRole("heading", { name: `Order ${code}` })).toBeInTheDocument();
    expect(screen.getByText(code).closest("bdi")).toHaveAttribute("dir", "ltr");
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("2 × Kebab")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: `View order ${code}` })).toHaveAttribute(
      "href",
      `/profile/orders/${code}`,
    );
    expect(screen.getByText("€22.50")).toBeInTheDocument();
  });

  it("keeps tab and pagination state in shareable URLs", async () => {
    const user = userEvent.setup();
    renderList();
    await user.click(screen.getByRole("tab", { name: "In progress (4)" }));
    expect(push).toHaveBeenCalledWith("/profile/orders?tab=active");
    await user.click(screen.getByRole("button", { name: "Go to page 2" }));
    expect(push).toHaveBeenCalledWith("/profile/orders?page=2");
  });

  it("shows a useful empty state", () => {
    renderList({
      ...page,
      items: [],
      total: 0,
      totalPages: 1,
      counts: { all: 0, active: 0, completed: 0, closed: 0 },
    });
    expect(screen.getByText("No orders match this view")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse menu" })).toHaveAttribute("href", "/menu");
  });
});
