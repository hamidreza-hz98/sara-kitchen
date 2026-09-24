import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { isSupportedLocale } from "@/constants";

import { resolveStorefrontMetadata } from "../storefront-metadata";
import { HomePage } from "./home-page";

type HomePageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: HomePageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const translations = await getTranslations({ locale, namespace: "storefront.metadata" });
  return resolveStorefrontMetadata("/", locale, {
    title: translations("title"),
    description: translations("description"),
  });
}

export default function Home() {
  return <HomePage />;
}
