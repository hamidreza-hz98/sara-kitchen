import { requireAdminPage } from "@/server/auth/page-guards";

import { ContactManager } from "./contact-manager";

export default async function DashboardContactPage() {
  const admin = await requireAdminPage("contacts:read");
  const permissions = new Set(admin.permissions);

  return (
    <ContactManager
      capabilities={{
        update: permissions.has("contacts:update"),
        delete: permissions.has("contacts:delete"),
      }}
    />
  );
}
