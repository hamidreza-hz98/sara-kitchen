import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isSupportedLocale } from "@/constants";

import { EntitySeoPage, entityPageMetadata } from "../../../entity-seo-page";

type CategoryPageProps = Readonly<{
  params: Promise<{ locale: string; categorySlug: string }>;
}>;

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { locale, categorySlug } = await params;
  return isSupportedLocale(locale) ? entityPageMetadata("category", categorySlug, locale) : {};
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { locale, categorySlug } = await params;
  if (!isSupportedLocale(locale)) notFound();
  return <EntitySeoPage kind="category" slug={categorySlug} locale={locale} />;
}
