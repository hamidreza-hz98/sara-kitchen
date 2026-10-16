"use client";

import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import { useTranslations } from "next-intl";

export type StorefrontSkeletonVariant =
  "home" | "collection" | "dish" | "article" | "information" | "checkout" | "profile" | "auth";

function CardSkeleton({ horizontal = false }: { horizontal?: boolean }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        overflow: "hidden",
        borderRadius: 4,
        display: horizontal ? { xs: "block", sm: "flex" } : "block",
      }}
    >
      <Skeleton
        variant="rectangular"
        height={200}
        sx={{ flexShrink: 0, width: horizontal ? { xs: "100%", sm: 240 } : "100%" }}
      />
      <Stack spacing={1.5} sx={{ p: 2.5, flex: 1 }}>
        <Skeleton variant="text" width="75%" height={30} />
        <Skeleton variant="text" width="95%" />
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="rounded" width={110} height={40} sx={{ mt: 1 }} />
      </Stack>
    </Paper>
  );
}

export function StorefrontRouteSkeleton({ variant }: { variant: StorefrontSkeletonVariant }) {
  const t = useTranslations("shared.feedback");
  return (
    <Container
      component="section"
      maxWidth="lg"
      role="status"
      aria-label={t("loading")}
      aria-busy="true"
      sx={{ py: { xs: 4, md: 7 }, minHeight: 520 }}
    >
      <Box aria-hidden="true">
        {variant === "home" ? (
          <>
            <Skeleton variant="rounded" height={380} sx={{ borderRadius: 4 }} />
            <Skeleton variant="text" width={250} height={48} sx={{ mt: 5, mb: 2 }} />
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, minmax(0, 1fr))",
                  md: "repeat(3, minmax(0, 1fr))",
                },
                gap: 3,
              }}
            >
              {[0, 1, 2].map((item) => (
                <CardSkeleton key={item} />
              ))}
            </Box>
          </>
        ) : variant === "collection" ? (
          <>
            <Skeleton variant="rounded" height={185} sx={{ borderRadius: 4 }} />
            <Skeleton variant="rounded" height={94} sx={{ borderRadius: 3, mt: 4, mb: 4 }} />
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, minmax(0, 1fr))",
                  md: "repeat(3, minmax(0, 1fr))",
                },
                gap: 3,
              }}
            >
              {[0, 1, 2, 3, 4, 5].map((item) => (
                <CardSkeleton key={item} />
              ))}
            </Box>
          </>
        ) : variant === "dish" ? (
          <>
            <Skeleton variant="text" width="55%" sx={{ mb: 3 }} />
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.2fr) minmax(0, .8fr)" },
                gap: 4,
              }}
            >
              <Skeleton variant="rounded" height={450} sx={{ borderRadius: 4 }} />
              <Stack spacing={2}>
                <Skeleton variant="text" width="85%" height={60} />
                <Skeleton variant="text" width="65%" />
                <Skeleton variant="text" width="95%" />
                <Skeleton variant="text" width="50%" height={48} />
                <Skeleton variant="rounded" height={50} />
              </Stack>
            </Box>
          </>
        ) : variant === "article" ? (
          <>
            <Skeleton variant="text" width="55%" sx={{ mb: 3 }} />
            <Skeleton variant="rounded" height={440} sx={{ borderRadius: 4 }} />
            <Stack spacing={1.5} sx={{ mt: 5, maxWidth: 760 }}>
              <Skeleton variant="text" width="80%" height={50} />
              <Skeleton variant="text" width="55%" />
              <Skeleton variant="text" width="100%" />
              <Skeleton variant="text" width="95%" />
              <Skeleton variant="text" width="90%" />
            </Stack>
          </>
        ) : variant === "checkout" ? (
          <>
            <Skeleton variant="text" width="40%" height={54} sx={{ mb: 3 }} />
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 320px" },
                gap: 3,
              }}
            >
              <Stack spacing={2}>
                {[0, 1].map((item) => (
                  <CardSkeleton key={item} horizontal />
                ))}
              </Stack>
              <Paper variant="outlined" sx={{ p: 3, borderRadius: 4, height: "fit-content" }}>
                <Stack spacing={2}>
                  <Skeleton variant="text" width="70%" height={38} />
                  <Skeleton variant="text" />
                  <Skeleton variant="text" />
                  <Skeleton variant="text" width="60%" height={36} />
                  <Skeleton variant="rounded" height={48} />
                </Stack>
              </Paper>
            </Box>
          </>
        ) : variant === "profile" ? (
          <>
            <Skeleton variant="text" width="45%" height={54} sx={{ mb: 3 }} />
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "260px minmax(0, 1fr)" },
                gap: 3,
              }}
            >
              <Skeleton variant="rounded" height={260} sx={{ borderRadius: 4 }} />
              <Stack spacing={2}>
                <Skeleton variant="rounded" height={100} sx={{ borderRadius: 4 }} />
                <Skeleton variant="rounded" height={180} sx={{ borderRadius: 4 }} />
              </Stack>
            </Box>
          </>
        ) : variant === "auth" ? (
          <Paper
            variant="outlined"
            sx={{ maxWidth: 480, mx: "auto", p: { xs: 3, sm: 5 }, borderRadius: 4 }}
          >
            <Stack spacing={2.5}>
              <Skeleton variant="text" width="75%" height={55} />
              <Skeleton variant="text" width="90%" />
              <Skeleton variant="rounded" height={54} />
              <Skeleton variant="rounded" height={54} />
              <Skeleton variant="rounded" height={48} />
            </Stack>
          </Paper>
        ) : (
          <>
            <Skeleton variant="text" width="45%" height={56} sx={{ mb: 3 }} />
            <Box
              sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 4 }}
            >
              <Stack spacing={2}>
                <Skeleton variant="text" />
                <Skeleton variant="text" />
                <Skeleton variant="text" width="75%" />
                <Skeleton variant="rounded" height={54} />
              </Stack>
              <Skeleton variant="rounded" height={300} sx={{ borderRadius: 4 }} />
            </Box>
          </>
        )}
      </Box>
    </Container>
  );
}
