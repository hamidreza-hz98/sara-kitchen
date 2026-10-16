import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isSupportedLocale } from "@/constants";
import { requireCustomerPage } from "@/server/auth/page-guards";
import { connectToDatabase } from "@/server/database";
import { getCustomerOrderDetail } from "@/server/modules/orders";

import { CustomerOrderDetails } from "./customer-order-details";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function CustomerOrderSummaryPage({
  params,
}: {
  params: Promise<{ locale: string; orderCode: string }>;
}) {
  const { locale: candidate, orderCode } = await params;
  const locale = isSupportedLocale(candidate) ? candidate : "en";
  const actor = await requireCustomerPage(`/profile/orders/${encodeURIComponent(orderCode)}`);
  const order = await getCustomerOrderDetail(await connectToDatabase(), actor.id, orderCode);
  if (!order) notFound();
  return <CustomerOrderDetails locale={locale} order={order} />;
}
