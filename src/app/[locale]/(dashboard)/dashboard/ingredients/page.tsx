import { requireAdminPage } from "@/server/auth/page-guards";

import { IngredientManager } from "./ingredient-manager";

export default async function DashboardIngredientsPage() {
  const admin = await requireAdminPage("ingredients:read");
  const permissions = new Set(admin.permissions);
  return (
    <IngredientManager
      capabilities={{
        create: permissions.has("ingredients:create"),
        update: permissions.has("ingredients:update"),
        delete: permissions.has("ingredients:delete"),
        uploadMedia: permissions.has("media:create"),
      }}
    />
  );
}
