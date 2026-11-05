"use client";

import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import Link from "next/link";

import { createBlogShareLinks } from "./blog-share";

const MIN_ENGAGEMENT_MS = 3_000;

export function BlogViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let sent = false;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      if (sent || document.visibilityState !== "visible") return;
      timer = setTimeout(() => {
        if (document.visibilityState !== "visible") return;
        sent = true;
        void fetch(`/api/blogs/${encodeURIComponent(slug)}/view`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ engagementMs: MIN_ENGAGEMENT_MS, visibilityState: "visible" }),
          credentials: "same-origin",
          keepalive: true,
        }).catch(() => undefined);
      }, MIN_ENGAGEMENT_MS);
    };
    schedule();
    document.addEventListener("visibilitychange", schedule);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [slug]);
  return null;
}

export function BlogShareControls({
  canonicalUrl,
  title,
}: {
  canonicalUrl: string;
  title: string;
}) {
  const t = useTranslations("storefront.blogDetail");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const links = createBlogShareLinks(canonicalUrl, title);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(canonicalUrl);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };
  return (
    <Stack
      component="section"
      aria-label={t("share")}
      spacing={1.5}
      sx={{ mt: 6, alignItems: "flex-start" }}
    >
      <Typography component="h2" variant="h6" sx={{ fontWeight: 800 }}>
        {t("share")}
      </Typography>
      <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
        {Object.entries(links).map(([platform, href]) => (
          <Button
            key={platform}
            component="a"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            variant="outlined"
            size="small"
            aria-label={t("shareOn", { platform })}
          >
            {t(platform as "whatsapp" | "telegram" | "facebook" | "linkedin")}
          </Button>
        ))}
        <Button
          type="button"
          onClick={() => {
            copy().catch(() => setCopyState("failed"));
          }}
          variant="outlined"
          size="small"
        >
          {copyState === "copied" ? t("copied") : t("copyLink")}
        </Button>
      </Stack>
      {copyState === "failed" && (
        <Typography role="status" variant="body2" color="error">
          {t("copyFailed")}
        </Typography>
      )}
    </Stack>
  );
}

export function BlogHeroActions({ canonicalUrl, title }: { canonicalUrl: string; title: string }) {
  const t = useTranslations("storefront.blogDetail");
  const [shareState, setShareState] = useState<"idle" | "copied" | "failed">("idle");

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title, url: canonicalUrl });
        return;
      }
      await navigator.clipboard.writeText(canonicalUrl);
      setShareState("copied");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareState("failed");
    }
  };

  return (
    <Stack
      direction="row"
      sx={{
        position: "absolute",
        insetBlockStart: { xs: 12, md: 20 },
        insetInline: { xs: 12, md: 20 },
        zIndex: 2,
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <IconButton
        component={Link}
        href="/blog"
        aria-label={t("blog")}
        sx={{
          bgcolor: "rgba(255,255,255,.94)",
          color: "text.primary",
          borderRadius: 1.25,
          boxShadow: "0 4px 16px #0002",
          "&:hover": { bgcolor: "white" },
        }}
      >
        <ArrowBackRoundedIcon sx={{ transform: "scaleX(var(--sk-direction-scale, 1))" }} />
      </IconButton>
      <IconButton
        onClick={() => {
          share().catch(() => setShareState("failed"));
        }}
        aria-label={t("share")}
        sx={{
          bgcolor: "rgba(255,255,255,.94)",
          color: "text.primary",
          borderRadius: 1.25,
          boxShadow: "0 4px 16px #0002",
          "&:hover": { bgcolor: "white" },
        }}
      >
        <ShareRoundedIcon />
      </IconButton>
      {(shareState === "copied" || shareState === "failed") && (
        <Typography
          role="status"
          sx={{
            position: "absolute",
            insetBlockStart: 52,
            insetInlineEnd: 0,
            px: 1.25,
            py: 0.75,
            borderRadius: 1,
            bgcolor: "background.paper",
            boxShadow: 2,
            fontSize: ".78rem",
          }}
        >
          {shareState === "copied" ? t("copied") : t("copyFailed")}
        </Typography>
      )}
    </Stack>
  );
}
