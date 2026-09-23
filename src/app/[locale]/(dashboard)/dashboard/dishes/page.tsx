import { requireAdminPage } from "@/server/auth/page-guards";

import { DishList } from "./dish-list";

export default async function DashboardDishesPage() {
  const admin = await requireAdminPage("dishes:read");
  return (
    <DishList
      canCreate={admin.permissions.includes("dishes:create")}
      canReadCategories={admin.permissions.includes("categories:read")}
      canRestore={admin.permissions.includes("dishes:delete")}
      canUpdate={admin.permissions.includes("dishes:update")}
    />
  );
}
