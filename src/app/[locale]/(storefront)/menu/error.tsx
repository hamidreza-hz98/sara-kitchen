"use client";

import { StorefrontRouteError } from "@/components/feedback/storefront-route-error";

export default function MenuError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <StorefrontRouteError {...props} kind="catalog" />;
}
