import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createAddressCrudServices,
  type AddressCrudDependencies,
} from "@/server/modules/addresses/service/address-crud";
import type {
  AddressRepository,
  AddressSnapshot,
} from "@/server/modules/addresses/repository/address";

const customerId = "a".repeat(24);
const otherCustomerId = "b".repeat(24);
const addressId = "c".repeat(24);
const self = { kind: "customer", id: customerId } as const;

function address(overrides: Partial<AddressSnapshot> = {}): AddressSnapshot {
  return {
    id: addressId,
    customerId,
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
    ...overrides,
  };
}

function harness() {
  let record = address();
  const audit = vi.fn(async () => undefined);
  const repository: AddressRepository = {
    listForCustomer: async (ownerId) => (ownerId === record.customerId ? [record] : []),
    findOwnedById: async (ownerId, id) =>
      ownerId === record.customerId && id === record.id ? record : null,
    create: async (ownerId, value) => {
      record = { ...record, ...value, customerId: ownerId };
      return record;
    },
    save: async (current, value) => {
      record = {
        ...current,
        name: value.name ?? current.name,
        recipientName: value.recipientName ?? current.recipientName,
        recipientMobile: value.recipientMobile ?? current.recipientMobile,
        formattedAddress: value.formattedAddress ?? current.formattedAddress,
        location: value.location ?? current.location,
        postalCode: value.postalCode ?? current.postalCode,
        deliveryNotes:
          value.deliveryNotes === undefined ? current.deliveryNotes : value.deliveryNotes,
        version: current.version + 1,
      };
      return record;
    },
    makeDefault: async (current) => {
      record = { ...current, isDefault: true, version: current.version + 1 };
      return record;
    },
    softDelete: async (current) => ({ ...current, version: current.version + 1 }),
  };
  const deps: AddressCrudDependencies = {
    repository,
    customerExists: vi.fn(async (id) => id === customerId),
    audit,
  };
  return { services: createAddressCrudServices(deps), audit, repository };
}

describe("address CRUD services", () => {
  it("scopes every customer read to the authenticated owner", async () => {
    const test = harness();
    await expect(test.services.get(self, customerId, addressId)).resolves.toMatchObject({
      id: addressId,
      customerId,
    });
    await expect(
      test.services.get({ kind: "customer", id: otherCustomerId }, customerId, addressId),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(test.services.get(self, customerId, "d".repeat(24))).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("supports create, update, default, and delete only for customers", async () => {
    const test = harness();
    const input = {
      name: "Work",
      recipientName: "Sara Kazemi",
      recipientMobile: "+351913456789",
      formattedAddress: "Avenida dos Aliados 10, Porto",
      location: { type: "Point" as const, coordinates: [-8.61, 41.15] as [number, number] },
      postalCode: "4000-064",
      deliveryNotes: null,
      isDefault: false,
    };
    await expect(test.services.create(self, customerId, input)).resolves.toMatchObject({
      name: "Work",
    });
    await expect(
      test.services.update(self, customerId, addressId, { deliveryNotes: "Ring once" }),
    ).resolves.toMatchObject({ deliveryNotes: "Ring once" });
    await expect(test.services.setDefault(self, customerId, addressId)).resolves.toMatchObject({
      isDefault: true,
    });
    await expect(test.services.remove(self, customerId, addressId)).resolves.toBeDefined();
    await expect(
      test.services.update(
        { kind: "admin", id: "e".repeat(24), role: "owner" },
        customerId,
        addressId,
        { name: "No admin mutation" },
      ),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("allows only sensitive-address admins to read", async () => {
    const test = harness();
    await expect(
      test.services.list({ kind: "admin", id: "e".repeat(24), role: "owner" }, customerId),
    ).resolves.toHaveLength(1);
    await expect(
      test.services.list({ kind: "admin", id: "f".repeat(24), role: "viewer" }, customerId),
    ).rejects.toMatchObject({ code: "forbidden" });
  });
});
