import Typography from "@mui/material/Typography";
import { getTranslations } from "next-intl/server";
import { requireAdminPage } from "@/server/auth/page-guards";

// Rendered only after the protected layout resolves an admin session in SK-0052.
// Real metrics and orders will replace this foundation state in the dashboard tasks.
export default async function DashboardPage() {
  await requireAdminPage("dashboard:view");
  const shell = await getTranslations("dashboard.shell");
  return (
    <Typography component="h1" variant="h2">
      {shell("previewTitle")}
    </Typography>
  );
}
