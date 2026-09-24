import { requireAdminPage } from "@/server/auth/page-guards";

import { DishEditor } from "./dish-editor";

export default async function DishModifyPage() {
  const admin = await requireAdminPage("dishes:read");
  const permissions = new Set(admin.permissions);
  return (
    <DishEditor
      canCreate={permissions.has("dishes:create")}
      canUpdate={permissions.has("dishes:update")}
      canUploadMedia={permissions.has("media:create")}
    />
  );
}
