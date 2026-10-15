import { requireAdminPage } from "@/server/auth/page-guards";

import { OrderList } from "./order-list";

export default async function DashboardOrdersPage() {
  const admin = await requireAdminPage("orders:read");
  const permissions = new Set(admin.permissions);
  return (
    <OrderList
      capabilities={{
        readSensitive: permissions.has("orders:read-sensitive"),
        update: permissions.has("orders:update"),
        cancel: permissions.has("orders:cancel"),
      }}
    />
  );
}
