import { requireAdminPage } from "@/server/auth/page-guards";

import { CategoryEditor } from "./category-editor";

export default async function CategoryModifyPage() {
  const admin = await requireAdminPage("categories:read");
  const permissions = new Set(admin.permissions);
  return (
    <CategoryEditor
      canCreate={permissions.has("categories:create")}
      canUpdate={permissions.has("categories:update")}
    />
  );
}
