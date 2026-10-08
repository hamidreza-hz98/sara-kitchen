import { requireAdminPage } from "@/server/auth/page-guards";

import { ActivityLogManager } from "./activity-log-manager";

export default async function DashboardActivityPage() {
  await requireAdminPage("logs:read");
  return <ActivityLogManager />;
}
