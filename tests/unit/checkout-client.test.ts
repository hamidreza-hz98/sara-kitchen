import { beforeEach, describe, expect, it } from "vitest";

import { canSubmitCheckout, checkoutIdempotencyKey } from "@/lib/checkout-client";
import type { CartClientSnapshot } from "@/lib/cart-client";

const cart: CartClientSnapshot = {
  id: "1".repeat(24),
  currency: "EUR",
  lines: [
    {
      dishId: "2".repeat(24),
      quantity: 1,
      name: "Fesenjan",
      slug: "fesenjan",
      image: null,
      pricing: null,
      availability: null,
    },
  ],
  notes: null,
  pricing: {
    subtotalCents: 1200,
    discountCents: 0,
    deliveryFeeCents: 0,
    taxCents: 0,
    adjustmentsCents: 0,
    totalCents: 1200,
    calculatedAt: null,
  },
  pricingChanged: false,
  availability: { valid: true, orderLeadTimeMinutes: 60, earliestReadyAt: null },
  pickupConfirmed: true,
  selectedAddressId: null,
  version: 3,
};

const ready = {
  cart,
  addressPresent: false,
  acceptedTerms: true,
  acceptedPrivacy: true,
  paymentMethod: "mbway" as const,
  paymentPhone: "+351912345678",
  submissionAvailable: true,
  pending: false,
};

beforeEach(() => sessionStorage.clear());

describe("checkout client safety", () => {
  it("keeps one key for the same cart version across retries", () => {
    const first = checkoutIdempotencyKey(cart.id!, 3);
    expect(checkoutIdempotencyKey(cart.id!, 3)).toBe(first);
    expect(checkoutIdempotencyKey(cart.id!, 4)).not.toBe(first);
  });

  it("refuses missing consent, invalid phone, unavailable provider and pending submissions", () => {
    expect(canSubmitCheckout(ready)).toBe(true);
    expect(canSubmitCheckout({ ...ready, acceptedTerms: false })).toBe(false);
    expect(canSubmitCheckout({ ...ready, acceptedPrivacy: false })).toBe(false);
    expect(canSubmitCheckout({ ...ready, paymentPhone: "912345678" })).toBe(false);
    expect(canSubmitCheckout({ ...ready, submissionAvailable: false })).toBe(false);
    expect(canSubmitCheckout({ ...ready, pending: true })).toBe(false);
  });

  it("requires an owned selected address for delivery", () => {
    const delivery = { ...cart, pickupConfirmed: false, selectedAddressId: "3".repeat(24) };
    expect(canSubmitCheckout({ ...ready, cart: delivery, addressPresent: false })).toBe(false);
    expect(canSubmitCheckout({ ...ready, cart: delivery, addressPresent: true })).toBe(true);
    expect(
      canSubmitCheckout({
        ...ready,
        cart: { ...delivery, availability: { ...delivery.availability, valid: false } },
        addressPresent: true,
      }),
    ).toBe(false);
  });
});
