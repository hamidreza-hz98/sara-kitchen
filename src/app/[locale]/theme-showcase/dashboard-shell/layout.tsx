import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { DashboardShell, dashboardPermissions } from "@/components/layout";

// Visual/interaction fixture only. This route is not available in production,
// does not grant a session, and contains no real administrator or domain data.
export const dynamic = "force-dynamic";

export default function DashboardShellShowcaseLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <DashboardShell
      actor={{
        displayName: "Design preview",
        roleLabel: "Preview",
        permissions: dashboardPermissions,
      }}
      basePath="/theme-showcase/dashboard-shell"
    >
      {children}
    </DashboardShell>
  );
}
