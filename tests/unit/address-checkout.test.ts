import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  CheckoutAddressError,
  verifyOwnedAddressForCheckout,
} from "@/server/modules/addresses/service/address-checkout";
import type { AddressSnapshot } from "@/server/modules/addresses/repository/address";

const saved: AddressSnapshot = {
  id: "a".repeat(24),
  customerId: "b".repeat(24),
  name: "Home",
  recipientName: "Sara Kazemi",
  recipientMobile: "+351912345678",
  formattedAddress: "Rua de Santa Catarina 100, Porto",
  location: { type: "Point", coordinates: [-8.606, 41.1496] },
  postalCode: "4000-008",
  deliveryNotes: null,
  isDefault: true,
  validation: { status: "unverified", provider: null, providerReference: null, checkedAt: null },
  version: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("checkout address verification", () => {
  it("reloads the owned address and checks the current delivery zone on every checkout", async () => {
    const repository = { findOwnedById: vi.fn(async () => saved) };
    const checker = vi.fn(async () => ({ eligible: true, distanceMeters: 2200 }));
    await verifyOwnedAddressForCheckout(
      repository,
      { customerId: saved.customerId, addressId: saved.id },
      checker,
    );
    await verifyOwnedAddressForCheckout(
      repository,
      { customerId: saved.customerId, addressId: saved.id },
      checker,
    );
    expect(repository.findOwnedById).toHaveBeenCalledTimes(2);
    expect(checker).toHaveBeenCalledTimes(2);
    expect(checker).toHaveBeenCalledWith(saved.location);
  });

  it("rejects unavailable ownership before revealing or checking the location", async () => {
    const checker = vi.fn(async () => ({ eligible: true }));
    await expect(
      verifyOwnedAddressForCheckout(
        { findOwnedById: async () => null },
        { customerId: "c".repeat(24), addressId: saved.id },
        checker,
      ),
    ).rejects.toEqual(new CheckoutAddressError("not_found"));
    expect(checker).not.toHaveBeenCalled();
  });

  it("rejects an address that is outside the live service area", async () => {
    await expect(
      verifyOwnedAddressForCheckout(
        { findOwnedById: async () => saved },
        { customerId: saved.customerId, addressId: saved.id },
        async () => ({ eligible: false, reason: "outside_porto" }),
      ),
    ).rejects.toMatchObject({ code: "outside_delivery_zone" });
  });
});
