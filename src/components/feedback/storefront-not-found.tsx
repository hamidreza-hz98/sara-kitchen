import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";

export function StorefrontNotFound({ kind }: { kind: "dish" | "story" | "category" }) {
  const t = useTranslations("storefront.routeFeedback");
  const title =
    kind === "dish"
      ? t("dishMissingTitle")
      : kind === "story"
        ? t("storyMissingTitle")
        : t("categoryMissingTitle");
  const description =
    kind === "dish"
      ? t("dishMissingDescription")
      : kind === "story"
        ? t("storyMissingDescription")
        : t("categoryMissingDescription");
  const primaryHref = kind === "story" ? "/blog" : "/menu";
  const primaryLabel = kind === "story" ? t("stories") : t("menu");
  return (
    <Container component="section" maxWidth="sm" sx={{ py: { xs: 7, md: 12 }, minHeight: 440 }}>
      <Typography component="p" color="primary" sx={{ fontWeight: 800, mb: 1 }}>
        404 · Sara Kitchen
      </Typography>
      <Typography component="h1" variant="h3" sx={{ fontWeight: 800 }}>
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 2, mb: 3 }}>
        {description}
      </Typography>
      <Stack direction="row" sx={{ gap: 1.5, flexWrap: "wrap" }}>
        <Button href={primaryHref} variant="contained">
          {primaryLabel}
        </Button>
        <Button href="/" variant="outlined">
          {t("home")}
        </Button>
      </Stack>
    </Container>
  );
}
