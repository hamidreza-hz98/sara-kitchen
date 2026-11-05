import type { SupportedLocale } from "@/constants";

type BlogCoverAsset = Readonly<{ url: string; alt: string }>;

const BLOG_COVER_ASSETS: Readonly<
  Record<string, Readonly<Record<SupportedLocale, BlogCoverAsset>>>
> = {
  "persian-stews-and-the-art-of-slow-cooking": {
    en: {
      url: "/images/blog/persian-stews.webp",
      alt: "Ghormeh sabzi and fesenjan with saffron rice on a Persian table",
    },
    "pt-PT": {
      url: "/images/blog/persian-stews.webp",
      alt: "Ghormeh sabzi e fesenjan com arroz de açafrão numa mesa persa",
    },
    fa: {
      url: "/images/blog/persian-stews.webp",
      alt: "قورمه‌سبزی و فسنجان در کنار برنج زعفرانی روی سفره‌ای ایرانی",
    },
  },
  "saffron-rice-and-the-persian-table": {
    en: {
      url: "/images/blog/persian-rice-table.webp",
      alt: "Golden Persian tahdig served with saffron rice and shared dishes",
    },
    "pt-PT": {
      url: "/images/blog/persian-rice-table.webp",
      alt: "Tahdig dourado servido com arroz de açafrão e pratos para partilhar",
    },
    fa: {
      url: "/images/blog/persian-rice-table.webp",
      alt: "ته‌دیگ طلایی در کنار برنج زعفرانی و خوراکی‌های سفرهٔ ایرانی",
    },
  },
};

export function getBlogCoverImage(slug: string, locale: SupportedLocale): BlogCoverAsset | null {
  return BLOG_COVER_ASSETS[slug]?.[locale] ?? null;
}
