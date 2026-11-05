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
  fallbackImage,
  fallbackImageAlt,
}: {
  slides: readonly Slide[];
  fallback: { eyebrow: string; title: string; description: string; action: string };
  fallbackImage: string;
  fallbackImageAlt: string;
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
        minHeight: { xs: 218, sm: 280, md: 430 },
        borderRadius: { xs: 4, md: 6 },
        color: "common.white",
        bgcolor: "#243e37",
        display: "flex",
        alignItems: "center",
      }}
    >
      {slide?.mobileImage && (
        <Box component="picture" sx={{ position: "absolute", inset: 0 }}>
          <Box component="source" media="(max-width: 600px)" srcSet={slide.mobileImage.url} />
          <Box
            alt={slide.image.alt}
            component="img"
            fetchPriority="high"
            src={slide.image.url}
            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </Box>
      )}
      {!slide?.mobileImage && (
        <Box
          alt={slide?.image.alt ?? fallbackImageAlt}
          component="img"
          fetchPriority="high"
          src={slide?.image.url ?? fallbackImage}
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center 58%",
          }}
        />
      )}
      <Box
        aria-hidden="true"
        sx={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(${rtl ? "270deg" : "90deg"}, rgba(10,14,13,.78), rgba(10,14,13,.48) 54%, rgba(10,14,13,.08))`,
        }}
      />
      <Stack
        spacing={{ xs: 0.8, md: 2 }}
        sx={{
          position: "relative",
          zIndex: 1,
          p: { xs: 2.2, sm: 3.5, md: 7 },
          maxWidth: { xs: 330, md: 670 },
        }}
      >
        {!slide && (
          <Typography
            variant="overline"
            sx={{
              display: "inline-flex",
              alignSelf: "flex-start",
              px: 1,
              py: 0.3,
              borderRadius: 1.5,
              bgcolor: "primary.main",
              fontSize: { xs: 8, md: 10 },
              fontWeight: 900,
              lineHeight: 1.3,
            }}
          >
            {fallback.eyebrow}
          </Typography>
        )}
        <Typography
          component="h1"
          variant="h2"
          sx={{
            fontSize: { xs: "clamp(1.25rem, 5.5vw, 2rem)", md: "3.5rem" },
            fontWeight: 900,
            lineHeight: 1.08,
            textWrap: "balance",
          }}
        >
          {slide?.title ?? fallback.title}
        </Typography>
        {(slide?.description || !slide) && (
          <Typography
            sx={{
              maxWidth: 440,
              color: "rgba(255,255,255,.88)",
              fontSize: { xs: "0.68rem", md: "1rem" },
              lineHeight: 1.5,
            }}
          >
            {slide?.description ?? fallback.description}
          </Typography>
        )}
        <Box sx={{ pt: { xs: 0.5, md: 0 } }}>
          <Button
            href={action?.href ?? "/menu"}
            variant="contained"
            color="primary"
            size="small"
            sx={{
              px: { xs: 1.5, md: 2.5 },
              py: { xs: 0.6, md: 1 },
              fontSize: { xs: "0.65rem", md: "0.9rem" },
              fontWeight: 800,
            }}
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
            insetInlineEnd: 12,
            insetBlockEnd: 12,
            bgcolor: "rgba(16,30,27,.72)",
            borderRadius: 3,
            px: 0.5,
          }}
        >
          <IconButton
            aria-label={t("previousSlide")}
            size="small"
            onClick={() => setIndex((current) => (current - 1 + slides.length) % slides.length)}
            sx={{ color: "white" }}
          >
            <DirectionalIcon mirrorInRtl>
              <ArrowBackRounded fontSize="small" />
            </DirectionalIcon>
          </IconButton>
          <IconButton
            aria-label={t("nextSlide")}
            size="small"
            onClick={() => setIndex((current) => (current + 1) % slides.length)}
            sx={{ color: "white" }}
          >
            <DirectionalIcon mirrorInRtl>
              <ArrowForwardRounded fontSize="small" />
            </DirectionalIcon>
          </IconButton>
          <Typography aria-live="polite" sx={{ alignSelf: "center", px: 0.5, fontSize: 11 }}>
            {index + 1}/{slides.length}
          </Typography>
        </Stack>
      )}
    </Paper>
  );
}
