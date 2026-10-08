import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createCustomerCrudServices,
  type CustomerCrudDependencies,
} from "@/server/modules/customers/service/customer-crud";
import type {
  CustomerProfileWrite,
  CustomerRepository,
  CustomerSnapshot,
} from "@/server/modules/customers/repository/customer";

const owner = { kind: "admin", id: "a".repeat(24), role: "owner" } as const;
const customerId = "b".repeat(24);
const self = { kind: "customer", id: customerId } as const;

function initial(): CustomerSnapshot {
  return {
    id: customerId,
    firstName: "Sara",
    lastName: "Kazemi",
    mobile: "+351912345678",
    email: "sara@example.com",
    mobileVerifiedAt: "2026-01-01T00:00:00.000Z",
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    passwordVersion: 1,
    marketingConsent: true,
    marketingConsentAt: "2026-01-01T00:00:00.000Z",
    termsAcceptedAt: "2026-01-01T00:00:00.000Z",
    status: "active",
    deletionRequestedAt: null,
    anonymizedAt: null,
    privacyRetentionReason: null,
    deletedAt: null,
    version: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function harness(historicalOrders = 2) {
  let record = initial();
  const audit = vi.fn(async () => undefined);
  const revokeSessions = vi.fn(async () => 3);
  const repository: CustomerRepository = {
    findById: async (id, includeAnonymized) =>
      id === record.id && (includeAnonymized || record.status !== "anonymized") ? record : null,
    list: async () => ({ items: [record], total: 1 }),
    saveProfile: async (current, value: CustomerProfileWrite) => {
      record = { ...current, ...value, version: current.version + 1 };
      return record;
    },
    setStatus: async (current, status) => {
      record = { ...current, status, version: current.version + 1 };
      return record;
    },
    anonymize: async (current, _actor, retentionReason, now) => {
      record = {
        ...current,
        firstName: "Deleted",
        lastName: "Customer",
        mobile: `anon_${current.id}`,
        email: null,
        mobileVerifiedAt: null,
        emailVerifiedAt: null,
        marketingConsent: false,
        marketingConsentAt: null,
        status: "anonymized",
        deletionRequestedAt: now.toISOString(),
        anonymizedAt: now.toISOString(),
        privacyRetentionReason: retentionReason,
        deletedAt: now.toISOString(),
        passwordVersion: current.passwordVersion + 1,
        version: current.version + 1,
      };
      return record;
    },
  };
  const deps: CustomerCrudDependencies = {
    repository,
    audit,
    revokeSessions,
    countHistoricalOrders: vi.fn(async () => historicalOrders),
    exportOrderHistory: vi.fn(async () => [{ code: "SK-1234", status: "paid" }]),
  };
  return {
    services: createCustomerCrudServices(deps),
    audit,
    revokeSessions,
    deps,
    record: () => record,
  };
}

describe("customer CRUD and privacy services", () => {
  it("allows authorized management reads and never exposes credential internals", async () => {
    const test = harness();
    const page = await test.services.list(owner, { page: 1, pageSize: 20 });
    expect(page.items[0]).toMatchObject({ mobile: "+351912345678", email: "sara@example.com" });
    expect(page.items[0]).not.toHaveProperty("passwordVersion");
    await expect(
      test.services.list(
        { kind: "admin", id: "c".repeat(24), role: "viewer" },
        { page: 1, pageSize: 20 },
      ),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("enforces self ownership and permits a normalized self-update", async () => {
    const test = harness();
    const updated = await test.services.update(self, customerId, {
      firstName: "  سارا  ",
      mobile: "913 456 789",
      marketingConsent: false,
    });
    expect(updated).toMatchObject({
      firstName: "سارا",
      mobile: "+351913456789",
      marketingConsent: false,
    });
    await expect(
      test.services.get({ kind: "customer", id: "c".repeat(24) }, customerId),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("exports only the owner's profile and allow-listed order history", async () => {
    const test = harness();
    const result = await test.services.exportAccount(self, customerId);
    expect(result.profile).toMatchObject({ id: customerId, email: "sara@example.com" });
    expect(result.profile).not.toHaveProperty("passwordVersion");
    expect(result.orders).toEqual([{ code: "SK-1234", status: "paid" }]);
    expect(test.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "export", outcome: "success" }),
    );
  });

  it("disables an account and revokes its active sessions", async () => {
    const test = harness();
    await expect(test.services.setStatus(owner, customerId, "disabled")).resolves.toMatchObject({
      status: "disabled",
    });
    expect(test.revokeSessions).toHaveBeenCalledWith(customerId, "account-disabled");
  });

  it("anonymizes instead of hard-deleting and preserves the order reference", async () => {
    const test = harness(4);
    const result = await test.services.anonymize(self, customerId);
    expect(result).toMatchObject({
      historicalOrders: 4,
      hardDeleted: false,
      customer: {
        status: "anonymized",
        email: null,
        mobile: null,
        privacyRetentionReason: "historical_orders",
      },
    });
    expect(test.record()).toMatchObject({
      mobile: `anon_${customerId}`,
      deletedAt: expect.any(String),
      passwordVersion: 2,
    });
    expect(test.revokeSessions).toHaveBeenCalledWith(customerId, "security");
    await expect(test.services.get(self, customerId)).rejects.toMatchObject({ code: "not_found" });
  });
});
