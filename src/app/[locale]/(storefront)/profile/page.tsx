import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { getTranslations } from "next-intl/server";

export default async function CustomerProfilePage() {
  const t = await getTranslations("profile");
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
      <Typography component="h1" variant="h2">
        {t("title")}
      </Typography>
    </Container>
  );
}
