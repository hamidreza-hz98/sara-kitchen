import { requireAdminPage } from "@/server/auth/page-guards";

import { MediaLibrary } from "./media-library";

export default async function DashboardMediaPage() {
  const admin = await requireAdminPage();
  const permissions = new Set(admin.permissions);

  return (
    <MediaLibrary
      capabilities={{
        create: permissions.has("media:create"),
        delete: permissions.has("media:delete"),
        update: permissions.has("media:update"),
      }}
    />
  );
}
