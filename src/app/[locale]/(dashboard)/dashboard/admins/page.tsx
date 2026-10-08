import { requireAdminPage } from "@/server/auth/page-guards";

import { AdminManager } from "./admin-manager";

export default async function DashboardAdminsPage() {
  const admin = await requireAdminPage("admins:read");
  const permissions = new Set(admin.permissions);

  return (
    <AdminManager
      currentAdminId={admin.id}
      capabilities={{
        create: permissions.has("admins:create"),
        update: permissions.has("admins:update"),
        assignRole: permissions.has("admins:assign-role"),
        disable: permissions.has("admins:disable"),
        delete: permissions.has("admins:delete"),
      }}
    />
  );
}
