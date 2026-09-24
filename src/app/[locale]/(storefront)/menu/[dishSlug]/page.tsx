import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isSupportedLocale } from "@/constants";

import { EntitySeoPage, entityPageMetadata } from "../../entity-seo-page";

type DishPageProps = Readonly<{ params: Promise<{ locale: string; dishSlug: string }> }>;

export async function generateMetadata({ params }: DishPageProps): Promise<Metadata> {
  const { locale, dishSlug } = await params;
  return isSupportedLocale(locale) ? entityPageMetadata("dish", dishSlug, locale) : {};
}

export default async function DishPage({ params }: DishPageProps) {
  const { locale, dishSlug } = await params;
  if (!isSupportedLocale(locale)) notFound();
  return <EntitySeoPage kind="dish" slug={dishSlug} locale={locale} />;
}
