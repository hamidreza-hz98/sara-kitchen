import { requireAdminPage } from "@/server/auth/page-guards";

import { CategoryList } from "./category-list";

export default async function DashboardCategoriesPage() {
  const admin = await requireAdminPage("categories:read");
  return (
    <CategoryList
      canCreate={admin.permissions.includes("categories:create")}
      canUpdate={admin.permissions.includes("categories:update")}
    />
  );
}
