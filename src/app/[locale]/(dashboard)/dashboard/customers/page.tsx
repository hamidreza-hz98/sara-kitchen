import { requireAdminPage } from "@/server/auth/page-guards";

import { CustomerManager } from "./customer-manager";

export default async function DashboardCustomersPage() {
  const admin = await requireAdminPage("customers:read");
  const permissions = new Set(admin.permissions);

  return (
    <CustomerManager
      capabilities={{
        readSensitive: permissions.has("customers:read-sensitive"),
        update: permissions.has("customers:update"),
        delete: permissions.has("customers:delete"),
      }}
    />
  );
}
