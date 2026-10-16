import type { RichTextDocument } from "@/lib/rich-text";

export type BlogDetailImage = Readonly<{ url: string; alt: string }>;
export type BlogEmbeddedMedia = Readonly<{ kind: "image" | "video"; url: string }>;
export type BlogRelatedDish = Readonly<{
  slug: string;
  name: string;
  image: BlogDetailImage | null;
  priceCents: number;
}>;
export type BlogRelatedArticle = Readonly<{
  slug: string;
  title: string;
  image: BlogDetailImage | null;
  readTimeMinutes: number;
}>;

export type BlogDetailContent = Readonly<{
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  publishedAt: string;
  readTimeMinutes: number;
  banner: BlogDetailImage | null;
  content: RichTextDocument;
  embeddedMedia: Readonly<Record<string, BlogEmbeddedMedia>>;
  relatedDishes: readonly BlogRelatedDish[];
  relatedBlogs: readonly BlogRelatedArticle[];
  canonicalUrl: string;
}>;
