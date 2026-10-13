import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { StorefrontShell } from "@/components/layout";
import { CartProvider, CustomerAuthProvider } from "@/providers";

export default async function StorefrontLayout({ children }: { children: ReactNode }) {
  const shell = await getTranslations("storefront.shell");

  return (
    <CustomerAuthProvider>
      <CartProvider>
        <StorefrontShell skipToContentLabel={shell("skipToContent")}>{children}</StorefrontShell>
      </CartProvider>
    </CustomerAuthProvider>
  );
}
