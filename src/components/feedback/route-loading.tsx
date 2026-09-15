"use client";

import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import { useTranslations } from "next-intl";

import { ContentSkeleton } from "@/components/ui";

export function RouteLoading() {
  const translations = useTranslations("shared.feedback");

  return (
    <Container component="main" maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
      <Stack aria-busy="true" spacing={5}>
        <ContentSkeleton
          height={40}
          label={translations("loading")}
          variant="rounded"
          width="55%"
        />
        <ContentSkeleton
          height={20}
          label={translations("loading")}
          variant="rounded"
          width="85%"
        />
        <Box
          sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 4 }}
        >
          {[0, 1, 2].map((item) => (
            <ContentSkeleton
              height={220}
              key={item}
              label={translations("loading")}
              variant="rounded"
            />
          ))}
        </Box>
      </Stack>
    </Container>
  );
}
