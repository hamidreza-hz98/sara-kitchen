"use client";

import { useCart } from "@/hooks";

import { StorefrontHeader, StorefrontMobileNavigation } from "./storefront-navigation";

export function StorefrontCartHeader() {
  const { itemCount } = useCart();
  return <StorefrontHeader cartItemCount={itemCount} />;
}

export function StorefrontCartMobileNavigation() {
  const { itemCount } = useCart();
  return <StorefrontMobileNavigation cartItemCount={itemCount} />;
}
