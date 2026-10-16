import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ActiveSessions } from "@/components/account/active-sessions";
import { revokeOtherSessionsAction } from "@/app/actions/revoke-other-sessions";
import { ChangePasswordForm } from "../change-password/password-form";
import { PrivacyActions } from "./privacy-actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile.securityPage");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function CustomerSessionsPage() {
  const t = await getTranslations("profile.securityPage");
  return (
    <Stack spacing={3} sx={{ maxWidth: 920 }}>
      <Box>
        <Typography component="h1" variant="h2">
          {t("title")}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          {t("intro")}
        </Typography>
      </Box>
      <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 4 }, borderRadius: 3 }}>
        <Typography component="h2" variant="h5" sx={{ mb: 2 }}>
          {t("passwordTitle")}
        </Typography>
        <ChangePasswordForm />
      </Paper>
      <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 4 }, borderRadius: 3 }}>
        <Typography component="h2" variant="h5" sx={{ mb: 2 }}>
          {t("sessionsTitle")}
        </Typography>
        <ActiveSessions
          principal="customer"
          revokeOthers={revokeOtherSessionsAction.bind(null, "customer")}
        />
      </Paper>
      <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 4 }, borderRadius: 3 }}>
        <Typography component="h2" variant="h5" sx={{ mb: 2 }}>
          {t("privacyTitle")}
        </Typography>
        <PrivacyActions />
      </Paper>
    </Stack>
  );
}
