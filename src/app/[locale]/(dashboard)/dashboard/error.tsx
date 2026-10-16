"use client";

import Button from "@mui/material/Button";
import { useTranslations } from "next-intl";

import { ErrorState } from "@/components/ui";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("dashboard.overview");
  return (
    <ErrorState
      title={t("loadErrorTitle")}
      description={t("loadError")}
      action={
        <Button onClick={reset} variant="contained">
          {t("retry")}
        </Button>
      }
    />
  );
}
