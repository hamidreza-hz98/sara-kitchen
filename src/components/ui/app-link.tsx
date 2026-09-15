import MuiLink from "@mui/material/Link";
import type { LinkProps as MuiLinkProps } from "@mui/material/Link";
import NextLink from "next/link";
import type { ComponentProps } from "react";

type NextLinkProps = ComponentProps<typeof NextLink>;

export type AppLinkProps = Pick<
  NextLinkProps,
  "children" | "href" | "prefetch" | "replace" | "scroll"
> &
  Pick<MuiLinkProps, "color" | "sx" | "underline" | "variant">;

export function AppLink({ underline = "hover", ...props }: AppLinkProps) {
  return <MuiLink component={NextLink} underline={underline} {...props} />;
}
