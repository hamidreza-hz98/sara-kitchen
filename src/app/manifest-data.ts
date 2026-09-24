import type { MetadataRoute } from "next";

import { type SupportedLocale, isRtlLocale } from "@/constants";

type ManifestCopy = Readonly<{
  description: string;
  name: string;
  shortName: string;
}>;

const MANIFEST_COPY = {
  en: {
    name: "Sara Kitchen — Persian Homemade Food",
    shortName: "Sara Kitchen",
    description: "Order Persian homemade food for pickup or delivery in Porto.",
  },
  "pt-PT": {
    name: "Sara Kitchen — Comida Persa Caseira",
    shortName: "Sara Kitchen",
    description: "Encomende comida persa caseira para recolha ou entrega no Porto.",
  },
  fa: {
    name: "آشپزخانه سارا — غذای خانگی ایرانی",
    shortName: "آشپزخانه سارا",
    description: "سفارش غذای خانگی ایرانی برای تحویل یا دریافت حضوری در پورتو.",
  },
} as const satisfies Record<SupportedLocale, ManifestCopy>;

export function createWebManifest(locale: SupportedLocale): MetadataRoute.Manifest {
  const copy = MANIFEST_COPY[locale];
  return {
    id: "/",
    name: copy.name,
    short_name: copy.shortName,
    description: copy.description,
    lang: locale,
    dir: isRtlLocale(locale) ? "rtl" : "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#F8F5F5",
    theme_color: "#FF6161",
    categories: ["food", "shopping", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    prefer_related_applications: false,
  };
}
