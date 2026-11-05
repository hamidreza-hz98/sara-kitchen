import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthenticationFrame } from "@/components/authentication/authentication-frame";

import { CustomerLoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("storefront.login");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function CustomerLoginPage() {
  const t = await getTranslations("storefront.login");
  return (
    <AuthenticationFrame title={t("title")} description={t("description")}>
      <CustomerLoginForm />
    </AuthenticationFrame>
  );
}
