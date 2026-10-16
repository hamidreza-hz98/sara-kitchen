import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isSupportedLocale } from "@/constants";
import { requireCustomerPage } from "@/server/auth/page-guards";
import { connectToDatabase } from "@/server/database";
import { createCustomerRepository } from "@/server/modules/customers";

import { CustomerInformationForm } from "./customer-information-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ProfileInformationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: candidate } = await params;
  const locale = isSupportedLocale(candidate) ? candidate : "en";
  const actor = await requireCustomerPage("/profile/information");
  const customer = await createCustomerRepository(await connectToDatabase()).findById(actor.id);
  if (!customer) notFound();

  return (
    <CustomerInformationForm
      initial={{
        firstName: customer.firstName,
        lastName: customer.lastName,
        mobile: customer.mobile,
        email: customer.email,
        mobileVerifiedAt: customer.mobileVerifiedAt,
        emailVerifiedAt: customer.emailVerifiedAt,
        marketingConsent: customer.marketingConsent,
      }}
      locale={locale}
    />
  );
}
