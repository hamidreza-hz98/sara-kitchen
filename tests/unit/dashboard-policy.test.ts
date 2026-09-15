import { describe, expect, it } from "vitest";

import {
  dashboardItemForPath,
  dashboardNavItems,
  visibleDashboardItems,
  type DashboardActor,
} from "@/components/layout/dashboard-policy";

const viewer: DashboardActor = {
  displayName: "Viewer",
  roleLabel: "Viewer",
  permissions: ["dashboard:view", "orders:read"],
};

describe("dashboard navigation policy", () => {
  it("filters entries from permissions, not role names", () => {
    expect(visibleDashboardItems(viewer).map((item) => item.key)).toEqual(["overview", "orders"]);
    expect(visibleDashboardItems({ ...viewer, permissions: ["admins:read"] })).toEqual([]);
  });

  it("resolves deep links to the longest matching section", () => {
    expect(dashboardItemForPath("/dashboard/orders/SK-1234", "/dashboard")?.key).toBe("orders");
    expect(dashboardItemForPath("/dashboard/settings/contact", "/dashboard")?.key).toBe("settings");
    expect(dashboardItemForPath("/dashboard", "/dashboard")?.key).toBe("overview");
    expect(dashboardItemForPath("/dashboard-other", "/dashboard")).toBeNull();
  });

  it("keeps every route within the protected dashboard namespace", () => {
    expect(new Set(dashboardNavItems.map((item) => item.path)).size).toBe(dashboardNavItems.length);
    expect(dashboardNavItems.every((item) => item.path === "" || item.path.startsWith("/"))).toBe(
      true,
    );
  });
});
