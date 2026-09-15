import Box from "@mui/material/Box";
import type { ReactNode } from "react";

import { SkipLink } from "./skip-link";
import { StorefrontFooter } from "./storefront-footer";
import { StorefrontHeader, StorefrontMobileNavigation } from "./storefront-navigation";

export type StorefrontShellProps = {
  cartItemCount?: number;
  children: ReactNode;
  skipToContentLabel: string;
};

export function StorefrontShell({
  cartItemCount = 0,
  children,
  skipToContentLabel,
}: StorefrontShellProps) {
  return (
    <Box sx={{ display: "flex", minHeight: "100dvh", flexDirection: "column" }}>
      <SkipLink label={skipToContentLabel} targetId="main-content" />
      <StorefrontHeader cartItemCount={cartItemCount} />
      <Box component="main" id="main-content" sx={{ flex: 1 }} tabIndex={-1}>
        {children}
      </Box>
      <StorefrontFooter />
      <StorefrontMobileNavigation cartItemCount={cartItemCount} />
    </Box>
  );
}
