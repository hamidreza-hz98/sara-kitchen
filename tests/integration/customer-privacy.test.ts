import { Mongoose } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getCustomerModel } from "@/server/modules/customers/model/customer";
import { createCustomerRepository } from "@/server/modules/customers/repository/customer";
import { hashCustomerPassword } from "@/server/modules/customers/service/password";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

describe("customer privacy persistence", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-customer-privacy-test");
    client = new Mongoose();
    await client.connect(database.uri);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("removes PII, invalidates credentials, and keeps a stable historical reference", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const Customer = getCustomerModel(client.connection);
    await Customer.syncIndexes();
    const original = await Customer.create({
      firstName: "Sara",
      lastName: "Kazemi",
      mobile: "912345678",
      email: "sara@example.com",
      passwordHash: await hashCustomerPassword("A strong customer passphrase 2026"),
      mobileVerifiedAt: new Date(),
      emailVerifiedAt: new Date(),
      marketingConsent: true,
      marketingConsentAt: new Date(),
    });
    const id = original._id.toHexString();
    const repository = createCustomerRepository(client.connection);
    const current = await repository.findById(id);
    if (!current) throw new Error("Customer fixture was not persisted.");

    const anonymized = await repository.anonymize(
      current,
      { kind: "customer", id },
      "historical_orders",
      new Date("2026-10-08T00:00:00.000Z"),
    );

    expect(anonymized).toMatchObject({
      id,
      firstName: "Deleted",
      lastName: "Customer",
      mobile: `anon_${id}`,
      email: null,
      status: "anonymized",
      passwordVersion: 2,
      privacyRetentionReason: "historical_orders",
      deletedAt: "2026-10-08T00:00:00.000Z",
    });
    expect(anonymized.mobileVerifiedAt).toBeNull();
    expect(anonymized.emailVerifiedAt).toBeNull();
    expect(anonymized.marketingConsent).toBe(false);
    await expect(repository.findById(id)).resolves.toBeNull();
    await expect(repository.findById(id, true)).resolves.toMatchObject({
      id,
      status: "anonymized",
    });

    await expect(
      Customer.create({
        firstName: "New",
        lastName: "Customer",
        mobile: "912345678",
        email: "sara@example.com",
        passwordHash: await hashCustomerPassword("Another secure customer passphrase 2026"),
      }),
    ).resolves.toBeDefined();
  });
});
