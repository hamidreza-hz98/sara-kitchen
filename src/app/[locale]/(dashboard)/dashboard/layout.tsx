import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { DashboardShell } from "@/components/layout";
import { connectToDatabase } from "@/server/database";
import { adminCookieName, resolveAdminActor } from "@/server/modules/auth";

export const dynamic = "force-dynamic";

export default async function ProtectedDashboardLayout({ children }: { children: ReactNode }) {
  const token = (await cookies()).get(adminCookieName())?.value;
  if (!token) redirect("/authentication");
  const admin = await resolveAdminActor(await connectToDatabase(), token);
  if (!admin || !admin.permissions.includes("dashboard:view")) redirect("/authentication");
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
