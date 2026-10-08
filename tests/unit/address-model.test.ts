import { Mongoose, Types } from "mongoose";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AddressOwnershipError,
  addressWriteSchema,
  isAddressOwner,
  normalizePortuguesePostalCode,
  planDefaultAddressCreate,
  replacementDefaultAddressId,
  requireAddressOwnership,
} from "@/server/modules/addresses";
import { getAddressModel } from "@/server/modules/addresses/model/address";

const ownerId = new Types.ObjectId();
const otherId = new Types.ObjectId();
const validAddress = {
  customerId: ownerId,
  name: "Home",
  recipientName: "Sara Kazemi",
  recipientMobile: "912 345 678",
  formattedAddress: "Rua de Santa Catarina 100, Porto",
  location: { type: "Point", coordinates: [-8.606, 41.1496] },
  postalCode: "4000 008",
};
const validWrite = {
  name: validAddress.name,
  recipientName: validAddress.recipientName,
  recipientMobile: validAddress.recipientMobile,
  formattedAddress: validAddress.formattedAddress,
  location: validAddress.location,
  postalCode: validAddress.postalCode,
};

describe("address model", () => {
  const client = new Mongoose();
  const Address = getAddressModel(client.connection);

  it("normalizes recipient data and Portuguese postal codes", async () => {
    const address = new Address(validAddress);
    await expect(address.validate()).resolves.toBeUndefined();
    expect(address.recipientMobile).toBe("+351912345678");
    expect(address.postalCode).toBe("4000-008");
    expect(address.deliveryNotes).toBeNull();
    expect(address.isDefault).toBe(false);
    expect(address.validation).toMatchObject({
      status: "unverified",
      provider: null,
      providerReference: null,
      checkedAt: null,
    });
    expect(normalizePortuguesePostalCode("۴۰۰۰ ۰۰۸")).toBe("4000-008");
  });

  it("keeps GeoJSON coordinate order and rejects swapped/out-of-range positions", async () => {
    const parsed = addressWriteSchema.parse(validWrite);
    expect(parsed.location.coordinates).toEqual([-8.606, 41.1496]);

    const invalidLongitude = new Address({
      ...validAddress,
      location: { type: "Point", coordinates: [200, 41.1496] },
    });
    await expect(invalidLongitude.validate()).rejects.toMatchObject({
      errors: expect.objectContaining({ "location.coordinates": expect.anything() }),
    });
    expect(
      addressWriteSchema.safeParse({
        ...validWrite,
        location: { type: "Point", coordinates: [41.1496, -181] },
      }).success,
    ).toBe(false);
  });

  it("rejects malformed Portuguese postal codes and unsafe recipient data", async () => {
    for (const postalCode of ["40000-08", "4000-08", "ABCD-123", "4000-008 extra"]) {
      expect(addressWriteSchema.safeParse({ ...validWrite, postalCode }).success).toBe(false);
    }
    const invalid = new Address({
      ...validAddress,
      name: "<script>",
      recipientName: " ",
      recipientMobile: "12345",
      postalCode: "400-0000",
    });
    await expect(invalid.validate()).rejects.toMatchObject({
      errors: expect.objectContaining({
        name: expect.anything(),
        recipientName: expect.anything(),
        recipientMobile: expect.anything(),
        postalCode: expect.anything(),
      }),
    });
  });

  it("requires coherent allow-listed provider validation metadata", async () => {
    const verified = new Address({
      ...validAddress,
      validation: {
        status: "verified",
        provider: "nominatim",
        providerReference: "osm:way:123",
        checkedAt: new Date(),
      },
    });
    await expect(verified.validate()).resolves.toBeUndefined();

    const incomplete = new Address({
      ...validAddress,
      validation: { status: "verified", provider: null, checkedAt: null },
    });
    await expect(incomplete.validate()).rejects.toMatchObject({
      errors: expect.objectContaining({ validation: expect.anything() }),
    });
  });

  it("defines immutable ownership, geospatial lookup, and one-active-default indexes", () => {
    expect(Address.schema.path("customerId").options.immutable).toBe(true);
    expect(Address.schema.options.timestamps).toBe(true);
    expect(Address.schema.indexes()).toEqual(
      expect.arrayContaining([
        [{ location: "2dsphere" }, expect.objectContaining({ name: "address_location_2dsphere" })],
        [
          { customerId: 1, isDefault: 1 },
          expect.objectContaining({
            unique: true,
            partialFilterExpression: { isDefault: true, deletedAt: null },
          }),
        ],
      ]),
    );
  });
});

describe("address ownership and default rules", () => {
  it("matches valid normalized owner identifiers and rejects cross-customer access", () => {
    expect(isAddressOwner(ownerId, ownerId.toHexString())).toBe(true);
    expect(isAddressOwner(ownerId, otherId)).toBe(false);
    expect(isAddressOwner("invalid", ownerId)).toBe(false);
    expect(() => requireAddressOwnership(ownerId, otherId)).toThrow(AddressOwnershipError);
  });

  it("makes the first address default and plans an explicit replacement", () => {
    expect(planDefaultAddressCreate(0, false)).toEqual({
      isDefault: true,
      unsetCurrentDefault: false,
    });
    expect(planDefaultAddressCreate(2, false)).toEqual({
      isDefault: false,
      unsetCurrentDefault: false,
    });
    expect(planDefaultAddressCreate(2, true)).toEqual({
      isDefault: true,
      unsetCurrentDefault: true,
    });
    expect(() => planDefaultAddressCreate(-1, false)).toThrow(RangeError);
    expect(replacementDefaultAddressId(true, ["oldest", "newest"])).toBe("oldest");
    expect(replacementDefaultAddressId(false, ["other"])).toBeNull();
    expect(replacementDefaultAddressId(true, [])).toBeNull();
  });
});
