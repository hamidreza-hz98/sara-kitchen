import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthenticationFrame } from "@/components/authentication/authentication-frame";

import { ResetPasswordForm } from "./reset-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("storefront.resetPassword");
  return {
    title: t("title"),
    robots: { index: false, follow: false },
    other: { referrer: "no-referrer" },
  };
}

export default async function ResetPasswordPage() {
  const t = await getTranslations("storefront.resetPassword");
  return (
    <AuthenticationFrame title={t("title")} description={t("description")}>
      <ResetPasswordForm />
    </AuthenticationFrame>
  );
}
