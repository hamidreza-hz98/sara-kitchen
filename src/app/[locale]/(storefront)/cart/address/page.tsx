import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { isSupportedLocale } from "@/constants";

import { CartStepTwo } from "./cart-step-two";

type CartAddressPageProps = Readonly<{ params: Promise<{ locale: string }> }>;

export async function generateMetadata({ params }: CartAddressPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "storefront.cartAddress" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function CartAddressPage({ params }: CartAddressPageProps) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  return <CartStepTwo />;
}
