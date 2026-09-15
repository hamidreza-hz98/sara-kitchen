import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { StorefrontShell } from "@/components/layout";

export default async function StorefrontLayout({ children }: { children: ReactNode }) {
  const shell = await getTranslations("storefront.shell");

  return <StorefrontShell skipToContentLabel={shell("skipToContent")}>{children}</StorefrontShell>;
}
