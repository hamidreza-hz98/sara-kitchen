"use client";

import Container from "@mui/material/Container";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { ActionButton, ErrorState } from "@/components/ui";
import { captureClientException } from "@/lib/monitoring/client";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const translations = useTranslations("errors.boundary");

  useEffect(() => {
    captureClientException(error);
  }, [error]);

  return (
    <Container component="main" maxWidth="sm" sx={{ py: { xs: 8, md: 14 } }}>
      <ErrorState
        action={
          <ActionButton variant="contained" onClick={reset}>
            {translations("retry")}
          </ActionButton>
        }
        description={translations("description")}
        title={translations("title")}
      />
    </Container>
  );
}
