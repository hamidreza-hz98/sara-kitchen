import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { isSupportedLocale } from "@/constants";

import { ReviewBridge } from "./review-bridge";

type Props = Readonly<{ params: Promise<{ locale: string }> }>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "storefront.cartReviewBridge" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function ReviewPage({ params }: Props) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  return <ReviewBridge />;
}
