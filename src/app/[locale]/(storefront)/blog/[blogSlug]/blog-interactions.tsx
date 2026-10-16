"use client";

import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

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
