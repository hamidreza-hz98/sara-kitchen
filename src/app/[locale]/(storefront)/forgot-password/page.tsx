import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthenticationFrame } from "@/components/authentication/authentication-frame";

import { ForgotPasswordForm } from "./request-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("storefront.forgotPassword");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations("storefront.forgotPassword");
  return (
    <AuthenticationFrame title={t("title")} description={t("description")}>
      <ForgotPasswordForm />
    </AuthenticationFrame>
  );
}
