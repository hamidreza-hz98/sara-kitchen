import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ADMIN_PERMISSIONS,
  ADMIN_ROLES,
  ROLE_PERMISSIONS,
  hasAdminPermission,
  permissionsForRole,
  type AdminPermission,
} from "@/constants/admin-access";
import {
  AdminPermissionDeniedError,
  requireAdminPermission,
} from "@/server/modules/admins/policy/authorization";
import { dashboardNavItems, visibleDashboardItems } from "@/components/layout/dashboard-policy";

describe("administrator role policy", () => {
  it("has complete, unique, valid grants for all six roles", () => {
    expect(ADMIN_ROLES).toHaveLength(6);
    expect(new Set(ADMIN_PERMISSIONS).size).toBe(ADMIN_PERMISSIONS.length);
    for (const role of ADMIN_ROLES) {
      const grants: readonly AdminPermission[] = ROLE_PERMISSIONS[role];
      expect(new Set(grants).size).toBe(grants.length);
      expect(grants.every((permission) => ADMIN_PERMISSIONS.includes(permission))).toBe(true);
      expect(grants).toContain("dashboard:view");
    }
    expect(ROLE_PERMISSIONS.owner).toEqual(ADMIN_PERMISSIONS);
  });

  it("fails closed for invalid roles and disabled accounts", () => {
    expect(permissionsForRole("administrator")).toEqual([]);
    expect(hasAdminPermission({ role: "owner", active: false }, "admins:assign-role")).toBe(false);
    expect(hasAdminPermission({ role: "unexpected", active: true }, "dashboard:view")).toBe(false);
    expect(() =>
      requireAdminPermission({ role: "viewer", active: true }, "admins:assign-role"),
    ).toThrow(AdminPermissionDeniedError);
    expect(() =>
      requireAdminPermission({ role: "owner", active: true }, "admins:assign-role"),
    ).not.toThrow();
  });

  it("separates sensitive reads and high-risk actions from ordinary reads", () => {
    const viewer = { role: "viewer", active: true };
    expect(hasAdminPermission(viewer, "dishes:read")).toBe(true);
    expect(hasAdminPermission(viewer, "customers:read-sensitive")).toBe(false);
    expect(hasAdminPermission(viewer, "transactions:read-sensitive")).toBe(false);
    expect(hasAdminPermission(viewer, "settings:read-sensitive")).toBe(false);
    expect(hasAdminPermission({ role: "manager", active: true }, "admins:assign-role")).toBe(false);
    expect(hasAdminPermission({ role: "manager", active: true }, "transactions:refund")).toBe(
      false,
    );
    expect(hasAdminPermission({ role: "order_operator", active: true }, "orders:update")).toBe(
      true,
    );
    expect(hasAdminPermission({ role: "order_operator", active: true }, "dishes:update")).toBe(
      false,
    );
  });

  it("drives navigation with the same permission vocabulary", () => {
    for (const item of dashboardNavItems) expect(ADMIN_PERMISSIONS).toContain(item.permission);
    const items = visibleDashboardItems({
      displayName: "Read only",
      roleLabel: "Viewer",
      permissions: permissionsForRole("viewer"),
    });
    expect(items.map((item) => item.key)).toContain("dishes");
    expect(items.map((item) => item.key)).not.toContain("orders");
  });

  it("documents every action-level permission in the matrix", () => {
    const matrix = readFileSync(resolve(process.cwd(), "docs/permission-matrix.md"), "utf8");
    for (const permission of ADMIN_PERMISSIONS) {
      const row = matrix.split("\n").find((line) => line.startsWith(`| \`${permission}\``));
      expect(row, `${permission} needs a matrix row`).toBeDefined();
      const grants = row
        ?.split("|")
        .slice(2, 8)
        .map((cell) => cell.trim() === "✓");
      expect(grants).toEqual(
        ADMIN_ROLES.map((role) => permissionsForRole(role).includes(permission)),
      );
    }
  });
});
