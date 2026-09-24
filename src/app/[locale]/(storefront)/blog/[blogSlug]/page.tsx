import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isSupportedLocale } from "@/constants";

import { EntitySeoPage, entityPageMetadata } from "../../entity-seo-page";

type BlogPageProps = Readonly<{ params: Promise<{ locale: string; blogSlug: string }> }>;

export async function generateMetadata({ params }: BlogPageProps): Promise<Metadata> {
  const { locale, blogSlug } = await params;
  return isSupportedLocale(locale) ? entityPageMetadata("blog", blogSlug, locale) : {};
}

export default async function BlogPage({ params }: BlogPageProps) {
  const { locale, blogSlug } = await params;
  if (!isSupportedLocale(locale)) notFound();
  return <EntitySeoPage kind="blog" slug={blogSlug} locale={locale} />;
}
