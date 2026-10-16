"use client";

import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { ErrorState } from "@/components/ui";
import { captureClientException } from "@/lib/monitoring/client";

export function StorefrontRouteError({
  error,
  reset,
  kind = "general",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  kind?: "general" | "catalog" | "stories" | "dish" | "blog";
}) {
  const t = useTranslations("storefront.routeFeedback");
  useEffect(() => {
    captureClientException(error);
  }, [error]);
  const heading =
    kind === "dish"
      ? t("dishErrorTitle")
      : kind === "blog"
        ? t("blogErrorTitle")
        : kind === "catalog"
          ? t("catalogErrorTitle")
          : kind === "stories"
            ? t("storiesErrorTitle")
            : t("errorTitle");
  const description =
    kind === "dish"
      ? t("dishErrorDescription")
      : kind === "blog"
        ? t("blogErrorDescription")
        : kind === "catalog"
          ? t("catalogErrorDescription")
          : kind === "stories"
            ? t("storiesErrorDescription")
            : t("errorDescription");
  return (
    <Container component="section" maxWidth="sm" sx={{ py: { xs: 7, md: 12 }, minHeight: 440 }}>
      <ErrorState
        headingLevel="h1"
        title={heading}
        description={description}
        action={
          <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
            <Button type="button" variant="contained" onClick={reset}>
              {t("retry")}
            </Button>
            <Button
              href={kind === "dish" ? "/menu" : kind === "blog" ? "/blog" : "/"}
              variant="outlined"
            >
              {kind === "dish" ? t("menu") : kind === "blog" ? t("stories") : t("home")}
            </Button>
          </Stack>
        }
      />
    </Container>
  );
}
