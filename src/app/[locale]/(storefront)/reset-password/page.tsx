import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ResetPasswordForm } from "./reset-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("storefront.resetPassword");
  return {
    title: t("title"),
    robots: { index: false, follow: false },
    other: { referrer: "no-referrer" },
  };
}

export default async function ResetPasswordPage() {
  const t = await getTranslations("storefront.resetPassword");
  return (
    <Container maxWidth="sm" sx={{ py: { xs: 6, md: 10 } }}>
      <Box
        sx={{
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 4,
          p: { xs: 4, sm: 6 },
        }}
      >
        <Typography component="h1" variant="h2" sx={{ mb: 2 }}>
          {t("title")}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 4 }}>
          {t("description")}
        </Typography>
        <ResetPasswordForm />
      </Box>
    </Container>
  );
}
