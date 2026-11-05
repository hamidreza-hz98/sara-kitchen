import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthenticationFrame } from "@/components/authentication/authentication-frame";

import { MobileVerificationForm } from "./verification-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("storefront.mobileVerification");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function MobileVerificationPage() {
  const t = await getTranslations("storefront.mobileVerification");
  return (
    <AuthenticationFrame title={t("title")} description={t("description")}>
      <MobileVerificationForm />
    </AuthenticationFrame>
  );
}
