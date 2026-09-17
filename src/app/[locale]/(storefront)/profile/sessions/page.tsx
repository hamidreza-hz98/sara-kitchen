import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ActiveSessions } from "@/components/account/active-sessions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shared.sessions");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function CustomerSessionsPage() {
  const t = await getTranslations("shared.sessions");
  return (
    <Container maxWidth="md" sx={{ py: { xs: 6, md: 10 } }}>
      <Typography component="h1" variant="h2" sx={{ mb: 4 }}>
        {t("title")}
      </Typography>
      <ActiveSessions principal="customer" />
    </Container>
  );
}
