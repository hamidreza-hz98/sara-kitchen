import { requireAdminPage } from "@/server/auth/page-guards";

import { StaticSeoManager } from "./static-seo-manager";

export default async function SeoManagementPage() {
  const admin = await requireAdminPage("seo:read");
  const permissions = new Set(admin.permissions);
  return (
    <StaticSeoManager
      canCreate={permissions.has("seo:create")}
      canUpdate={permissions.has("seo:update")}
      canUploadMedia={permissions.has("media:create")}
    />
  );
}
