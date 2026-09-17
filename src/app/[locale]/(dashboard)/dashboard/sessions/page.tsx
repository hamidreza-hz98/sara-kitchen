import Typography from "@mui/material/Typography";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ActiveSessions } from "@/components/account/active-sessions";
import { revokeOtherSessionsAction } from "@/app/actions/revoke-other-sessions";
import { requireAdminPage } from "@/server/auth/page-guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shared.sessions");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function AdminSessionsPage() {
  await requireAdminPage("dashboard:view");
  const t = await getTranslations("shared.sessions");
  return (
    <>
      <Typography component="h1" variant="h2" sx={{ mb: 4 }}>
        {t("title")}
      </Typography>
      <ActiveSessions
        principal="admin"
        revokeOthers={revokeOtherSessionsAction.bind(null, "admin")}
      />
    </>
  );
}
