"use client";

import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { DirectionalIcon } from "@/components";
import { isRtlLocale, type SupportedLocale } from "@/constants";

import type { HomeContent } from "./home-content";

type Slide = HomeContent["hero"][number];

export function HomeHero({
  slides,
  fallback,
}: {
  slides: readonly Slide[];
  fallback: { eyebrow: string; title: string; description: string; action: string };
}) {
  const t = useTranslations("storefront.home");
  const rtl = isRtlLocale(useLocale() as SupportedLocale);
  const [index, setIndex] = useState(0);
  const slide = slides[index] ?? null;
  const action = slide?.link;
  return (
    <Paper
      component="section"
      aria-label={t("hero")}
      sx={{
        position: "relative",
        overflow: "hidden",
        minHeight: { xs: 370, md: 470 },
        borderRadius: { xs: 4, md: 6 },
        color: "common.white",
        bgcolor: "#243e37",
        display: "flex",
        alignItems: "center",
      }}
    >
      {slide && (
        <Box component="picture" sx={{ position: "absolute", inset: 0 }}>
          {slide.mobileImage && (
            <Box component="source" media="(max-width: 600px)" srcSet={slide.mobileImage.url} />
          )}
          <Box
            component="img"
            src={slide.image.url}
            alt={slide.image.alt}
            fetchPriority="high"
            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </Box>
      )}
      <Box
        aria-hidden="true"
        sx={{
          position: "absolute",
          inset: 0,
          background: {
            xs: "rgba(16,30,27,.82)",
            md: `linear-gradient(${rtl ? "270deg" : "90deg"}, rgba(16,30,27,.92), rgba(16,30,27,.76) 65%, rgba(16,30,27,.42))`,
          },
        }}
      />
      <Stack
        spacing={2.5}
        sx={{ position: "relative", zIndex: 1, p: { xs: 4, sm: 6, md: 8 }, maxWidth: 650 }}
      >
        {!slide && (
          <Typography variant="overline" sx={{ fontWeight: 800 }}>
            {fallback.eyebrow}
          </Typography>
        )}
        <Typography component="h1" variant="h2" sx={{ fontWeight: 900 }}>
          {slide?.title ?? fallback.title}
        </Typography>
        {(slide?.description || !slide) && (
          <Typography variant="body1">{slide?.description ?? fallback.description}</Typography>
        )}
        <Box>
          <Button
            href={action?.href ?? "/menu"}
            variant="contained"
            color="primary"
            {...(action?.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {slide?.ctaLabel || fallback.action}
          </Button>
        </Box>
      </Stack>
      {slides.length > 1 && (
        <Stack
          direction="row"
          spacing={0.5}
          sx={{
            position: "absolute",
            zIndex: 2,
            insetInlineEnd: 20,
            insetBlockEnd: 20,
            bgcolor: "rgba(16,30,27,.88)",
            borderRadius: 3,
            px: 1,
          }}
        >
          <IconButton
            aria-label={t("previousSlide")}
            onClick={() => setIndex((current) => (current - 1 + slides.length) % slides.length)}
            sx={{ color: "white" }}
          >
            <DirectionalIcon mirrorInRtl>
              <ArrowBackRounded />
            </DirectionalIcon>
          </IconButton>
          <IconButton
            aria-label={t("nextSlide")}
            onClick={() => setIndex((current) => (current + 1) % slides.length)}
            sx={{ color: "white" }}
          >
            <DirectionalIcon mirrorInRtl>
              <ArrowForwardRounded />
            </DirectionalIcon>
          </IconButton>
          <Typography aria-live="polite" sx={{ alignSelf: "center", px: 1 }}>
            {index + 1}/{slides.length}
          </Typography>
        </Stack>
      )}
    </Paper>
  );
}
