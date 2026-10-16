import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { getTranslations } from "next-intl/server";

export default async function CustomerProfilePage() {
  const t = await getTranslations("profile");
  return (
    <Stack spacing={3}>
      <Typography component="h1" variant="h2">
        {t("title")}
      </Typography>
      <NextLink href="/profile/change-password">{t("changePassword.title")}</NextLink>
      <Typography sx={{ mt: 2 }}>
        <NextLink href="/profile/sessions">{t("sessionsLink")}</NextLink>
      </Typography>
    </Stack>
  );
}
