import type { ReactNode } from "react";

import { DashboardShell } from "@/components/layout";
import { requireAdminPage } from "@/server/auth/page-guards";

export const dynamic = "force-dynamic";

export default async function ProtectedDashboardLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdminPage();
  return (
    <DashboardShell
      actor={{
        displayName: admin.displayName,
        roleLabel: admin.role,
        permissions: admin.permissions,
      }}
      enableSignOut
    >
      {children}
    </DashboardShell>
  );
}
