import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";

export default function NotFound() {
  const translations = useTranslations("errors.notFound");
  const routes = useTranslations("storefront.routeFeedback");

  return (
    <Container
      component="main"
      id="main-content"
      maxWidth="sm"
      sx={{ py: { xs: 7, md: 12 }, minHeight: 440 }}
    >
      <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
        <Typography component="h1" variant="h3">
          {translations("title")}
        </Typography>
        <Typography>{translations("description")}</Typography>
        <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
          <Button href="/" variant="contained">
            {translations("home")}
          </Button>
          <Button href="/menu" variant="outlined">
            {routes("menu")}
          </Button>
          <Button href="/blog" variant="outlined">
            {routes("stories")}
          </Button>
        </Stack>
      </Stack>
    </Container>
  );
}
