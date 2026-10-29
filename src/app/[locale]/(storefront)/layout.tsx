import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { StorefrontShell } from "@/components/layout";
import { CartProvider, CustomerAuthProvider } from "@/providers";

export const dynamic = "force-dynamic";

export default async function StorefrontLayout({ children }: { children: ReactNode }) {
  await connection();
  const shell = await getTranslations("storefront.shell");

  return (
    <CustomerAuthProvider>
      <CartProvider>
        <StorefrontShell skipToContentLabel={shell("skipToContent")}>{children}</StorefrontShell>
      </CartProvider>
    </CustomerAuthProvider>
  );
}
