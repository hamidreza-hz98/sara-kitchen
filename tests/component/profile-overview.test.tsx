import { ThemeProvider } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  ProfileOverview,
  type ProfileOverviewProps,
} from "@/app/[locale]/(storefront)/profile/profile-overview";
import { appTheme } from "@/theme";

const labels: ProfileOverviewProps["labels"] = {
  title: "My profile",
  intro: "Your orders and account at a glance.",
  totalOrders: "Total orders",
  totalSpent: "Total spent",
  lastOrder: "Last order",
  noOrders: "No orders yet.",
  latestOrderStatus: "Confirmed",
  viewOrder: "View my orders",
  specialOffer: "Special offer",
  exploreOffer: "Explore this dish",
  shortcuts: "Quick links",
  orders: "Orders",
  addresses: "Addresses",
  information: "Personal information",
  menu: "Browse the menu",
};

function renderOverview(input: Omit<ProfileOverviewProps, "labels">) {
  return render(
    <ThemeProvider theme={appTheme} defaultMode="light">
      <ProfileOverview labels={labels} {...input} />
    </ThemeProvider>,
  );
}

describe("customer profile overview", () => {
  it("shows an honest zero state without inventing a special offer", () => {
    renderOverview({ totalOrders: "0", totalSpent: "€0.00", latestOrder: null, offer: null });
    expect(screen.getByRole("heading", { level: 1, name: "My profile" })).toBeVisible();
    expect(screen.getByText("No orders yet.")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Special offer" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse the menu" })).toHaveAttribute("href", "/menu");
    expect(screen.getByRole("link", { name: "Addresses" })).toHaveAttribute(
      "href",
      "/profile/addresses",
    );
  });

  it("shows the latest order, spend and configured discounted dish", () => {
    renderOverview({
      totalOrders: "2",
      totalSpent: "€15.00",
      latestOrder: { code: "SK-1234", date: "16 Oct 2026", price: "€20.00" },
      offer: { slug: "fesenjan", name: "Fesenjan", price: "€10.00", originalPrice: "€12.00" },
    });
    expect(screen.getByText("SK-1234")).toBeVisible();
    expect(screen.getByText("€15.00")).toBeVisible();
    expect(screen.getByText("Fesenjan")).toBeVisible();
    expect(screen.getByRole("link", { name: "View my orders" })).toHaveAttribute(
      "href",
      "/profile/orders",
    );
    expect(screen.getByRole("link", { name: "Explore this dish" })).toHaveAttribute(
      "href",
      "/menu/fesenjan",
    );
  });
});
