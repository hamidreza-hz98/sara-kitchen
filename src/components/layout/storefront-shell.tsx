import Box from "@mui/material/Box";
import type { ReactNode } from "react";

import { SkipLink } from "./skip-link";
import { StorefrontCartHeader, StorefrontCartMobileNavigation } from "./storefront-cart-chrome";
import { StorefrontFooter } from "./storefront-footer";

export type StorefrontShellProps = {
  children: ReactNode;
  skipToContentLabel: string;
};

export function StorefrontShell({ children, skipToContentLabel }: StorefrontShellProps) {
  return (
    <Box sx={{ display: "flex", minHeight: "100dvh", flexDirection: "column" }}>
      <SkipLink label={skipToContentLabel} targetId="main-content" />
      <StorefrontCartHeader />
      <Box component="main" id="main-content" sx={{ flex: 1 }} tabIndex={-1}>
        {children}
      </Box>
      <StorefrontFooter />
      <StorefrontCartMobileNavigation />
    </Box>
  );
}
