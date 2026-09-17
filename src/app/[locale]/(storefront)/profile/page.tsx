import Container from "@mui/material/Container";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { getTranslations } from "next-intl/server";

export default async function CustomerProfilePage() {
  const t = await getTranslations("profile");
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
      <Typography component="h1" variant="h2">
        {t("title")}
      </Typography>
      <Link component={NextLink} href="/profile/change-password">
        {t("changePassword.title")}
      </Link>
      <Typography sx={{ mt: 2 }}>
        <Link component={NextLink} href="/profile/sessions">
          {t("sessionsLink")}
        </Link>
      </Typography>
    </Container>
  );
}
