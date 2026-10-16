import Typography from "@mui/material/Typography";
import { getLocale, getTranslations } from "next-intl/server";
import { hasAdminPermission } from "@/constants/admin-access";
import { isSupportedLocale } from "@/constants";
import { requireAdminPage } from "@/server/auth/page-guards";
import { connectToDatabase } from "@/server/database";
import { getCachedDashboardAggregation } from "@/server/modules/analytics";

export default async function DashboardPage() {
  const admin = await requireAdminPage("dashboard:view");
  const dashboard = await getTranslations("dashboard");
  const shell = await getTranslations("dashboard.shell");
  if (!hasAdminPermission({ role: admin.role, active: true }, "analytics:read")) {
    return (
      <Typography component="h1" variant="h2">
        {shell("previewTitle")}
      </Typography>
    );
  }
  const requestedLocale = await getLocale();
  const locale = isSupportedLocale(requestedLocale) ? requestedLocale : "en";
  const snapshot = await getCachedDashboardAggregation(
    await connectToDatabase(),
    { id: admin.id, role: admin.role, active: true },
    { locale },
  );
  return (
    <>
      <Typography component="h1" variant="h2">
        {dashboard("title")}
      </Typography>
      <Typography component="p" variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {shell("dataAsOf", {
          timestamp: new Intl.DateTimeFormat(locale, {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: snapshot.timeZone,
          }).format(new Date(snapshot.freshness.generatedAt)),
        })}
      </Typography>
    </>
  );
}
