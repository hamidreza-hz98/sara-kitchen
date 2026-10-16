import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { isSupportedLocale } from "@/constants";
import { requireCustomerPage } from "@/server/auth/page-guards";
import { connectToDatabase } from "@/server/database";
import {
  getCustomerPaymentResult,
  paymentResultQuerySchema,
  PaymentResultError,
} from "@/server/modules/orders";

import { PaymentResultView } from "./payment-result-view";

type Props = Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "storefront.paymentResult" });
  return { title: t("metadataTitle"), robots: { index: false, follow: false } };
}

export default async function PaymentResultPage({ params, searchParams }: Props) {
  const [{ locale }, query, customer] = await Promise.all([
    params,
    searchParams,
    requireCustomerPage(),
  ]);
  if (!isSupportedLocale(locale)) notFound();
  const rawOrder = Array.isArray(query.order) ? query.order[0] : query.order;
  const parsed = paymentResultQuerySchema.safeParse({ order: rawOrder });
  if (!parsed.success) notFound();
  let initialResult;
  try {
    initialResult = await getCustomerPaymentResult(
      await connectToDatabase(),
      customer.id,
      parsed.data.order,
    );
  } catch (error) {
    if (error instanceof PaymentResultError) notFound();
    throw error;
  }
  return <PaymentResultView initialResult={initialResult} />;
}
