import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthenticationFrame } from "@/components/authentication/authentication-frame";

import { CustomerSignupForm } from "./signup-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("storefront.signup");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function SignupPage() {
  const t = await getTranslations("storefront.signup");
  return (
    <AuthenticationFrame title={t("title")} description={t("description")}>
      <CustomerSignupForm />
    </AuthenticationFrame>
  );
}
