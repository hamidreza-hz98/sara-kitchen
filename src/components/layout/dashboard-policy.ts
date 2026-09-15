export const dashboardPermissions = [
  "dashboard:view",
  "media:read",
  "categories:read",
  "dishes:read",
  "ingredients:read",
  "blogs:read",
  "customers:read",
  "admins:read",
  "orders:read",
  "transactions:read",
  "contacts:read",
  "logs:read",
  "settings:read",
] as const;

export type DashboardPermission = (typeof dashboardPermissions)[number];

export type DashboardActor = {
  displayName: string;
  roleLabel: string;
  permissions: readonly DashboardPermission[];
};

export type DashboardSection = "main" | "management" | "settings";
export type DashboardNavKey =
  | "overview"
  | "categories"
  | "dishes"
  | "ingredients"
  | "media"
  | "blogs"
  | "customers"
  | "admins"
  | "orders"
  | "transactions"
  | "contacts"
  | "activity"
  | "settings";

export type DashboardNavItem = {
  key: DashboardNavKey;
  path: string;
  permission: DashboardPermission;
  section: DashboardSection;
};

export const dashboardNavItems = [
  { key: "overview", path: "", permission: "dashboard:view", section: "main" },
  { key: "categories", path: "/categories", permission: "categories:read", section: "main" },
  { key: "dishes", path: "/dishes", permission: "dishes:read", section: "main" },
  { key: "ingredients", path: "/ingredients", permission: "ingredients:read", section: "main" },
  { key: "media", path: "/media", permission: "media:read", section: "main" },
  { key: "blogs", path: "/blog", permission: "blogs:read", section: "main" },
  { key: "customers", path: "/customers", permission: "customers:read", section: "management" },
  { key: "admins", path: "/admins", permission: "admins:read", section: "management" },
  { key: "orders", path: "/orders", permission: "orders:read", section: "management" },
  {
    key: "transactions",
    path: "/transactions",
    permission: "transactions:read",
    section: "management",
  },
  { key: "contacts", path: "/contact", permission: "contacts:read", section: "management" },
  { key: "activity", path: "/activity", permission: "logs:read", section: "management" },
  { key: "settings", path: "/settings", permission: "settings:read", section: "settings" },
] as const satisfies readonly DashboardNavItem[];

export function visibleDashboardItems(actor: DashboardActor): readonly DashboardNavItem[] {
  const permissions = new Set(actor.permissions);
  if (!permissions.has("dashboard:view")) return [];
  return dashboardNavItems.filter((item) => permissions.has(item.permission));
}

export function dashboardItemForPath(pathname: string, basePath: string): DashboardNavItem | null {
  if (pathname === basePath || pathname === `${basePath}/`) return dashboardNavItems[0];
  const relativePath = pathname.startsWith(`${basePath}/`) ? pathname.slice(basePath.length) : null;
  if (!relativePath) return null;
  return (
    [...dashboardNavItems]
      .filter(
        (item) =>
          item.path && (relativePath === item.path || relativePath.startsWith(`${item.path}/`)),
      )
      .sort((left, right) => right.path.length - left.path.length)[0] ?? null
  );
}
