"use client";

import { StorefrontRouteError } from "@/components/feedback/storefront-route-error";

export default function BlogIndexError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <StorefrontRouteError {...props} kind="stories" />;
}
