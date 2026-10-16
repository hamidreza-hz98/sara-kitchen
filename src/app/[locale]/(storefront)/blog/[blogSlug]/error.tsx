"use client";

import { StorefrontRouteError } from "@/components/feedback/storefront-route-error";

export default function ArticleError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <StorefrontRouteError {...props} kind="blog" />;
}
