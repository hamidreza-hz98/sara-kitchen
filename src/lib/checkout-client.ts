import type { StoredRichText } from "@/lib/rich-text";

import type { CartClientSnapshot } from "./cart-client";

export type CheckoutReviewPolicy = Readonly<{
  id: string;
  documentType: "terms-of-service" | "privacy-policy";
  version: number;
  title: string;
  summary: string;
  sections: readonly Readonly<{ id: string; title: string; content: StoredRichText }>[];
}>;

export type CheckoutReviewData = Readonly<{
  cart: CartClientSnapshot | null;
  address: Readonly<{
    id: string;
    name: string;
    recipientName: string;
    recipientMobile: string;
    formattedAddress: string;
    postalCode: string;
    deliveryNotes: string | null;
  }> | null;
  policies: readonly CheckoutReviewPolicy[];
  paymentMethods: readonly Readonly<{ type: "mbway"; enabled: boolean }>[];
  submissionAvailable: boolean;
}>;

const fallbackKeys = new Map<string, string>();

/** Keep one request key across retries/reloads for the same cart revision. */
export function checkoutIdempotencyKey(cartId: string, version: number): string {
  const storageKey = `sara-checkout:${cartId}:${version}`;
  try {
    const existing = sessionStorage.getItem(storageKey);
    if (existing) return existing;
  } catch {
    // Private browsing may disallow storage; the in-memory key still covers this tab.
  }
  const existingFallback = fallbackKeys.get(storageKey);
  if (existingFallback) return existingFallback;
  const key = crypto.randomUUID();
  fallbackKeys.set(storageKey, key);
  try {
    sessionStorage.setItem(storageKey, key);
  } catch {
    // The key remains stable for this tab until it closes.
  }
  return key;
}

export function canSubmitCheckout(
  input: Readonly<{
    cart: CartClientSnapshot | null;
    addressPresent: boolean;
    acceptedTerms: boolean;
    acceptedPrivacy: boolean;
    paymentMethod: "mbway" | null;
    paymentPhone: string;
    submissionAvailable: boolean;
    pending: boolean;
  }>,
): boolean {
  const cart = input.cart;
  return Boolean(
    !input.pending &&
    input.submissionAvailable &&
    cart?.id &&
    cart.version &&
    cart.lines.length > 0 &&
    cart.availability.valid &&
    (cart.pickupConfirmed || (cart.selectedAddressId && input.addressPresent)) &&
    input.acceptedTerms &&
    input.acceptedPrivacy &&
    input.paymentMethod === "mbway" &&
    /^\+3519\d{8}$/u.test(input.paymentPhone.trim()),
  );
}
