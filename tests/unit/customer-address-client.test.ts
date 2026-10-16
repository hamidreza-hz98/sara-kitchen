import { describe, expect, it } from "vitest";

import { parseCustomerAddress, validateCustomerAddress } from "@/components/address/address-client";

const address = {
  id: "a".repeat(24),
  name: "Home",
  recipientName: "Sara Kazemi",
  recipientMobile: "+351912345678",
  formattedAddress: "Rua das Flores 1, Porto",
  location: { type: "Point" as const, coordinates: [-8.606, 41.1496] as [number, number] },
  postalCode: "۴۰۰۰-۰۰۸",
  deliveryNotes: null,
  isDefault: true,
  version: 1,
};

describe("customer address browser projection", () => {
  it("accepts localized postal digits using the server's normalization", () => {
    expect(validateCustomerAddress(address)).toBe(true);
    expect(parseCustomerAddress(address)).toMatchObject({ id: address.id, isDefault: true });
  });

  it("rejects malformed and missing coordinates", () => {
    expect(
      validateCustomerAddress({ ...address, location: { type: "Point", coordinates: [999, 41] } }),
    ).toBe(false);
    expect(
      parseCustomerAddress({ ...address, location: { type: "Point", coordinates: [0] } }),
    ).toBeNull();
  });
});
