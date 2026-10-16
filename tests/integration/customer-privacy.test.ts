import { Mongoose } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getCustomerModel } from "@/server/modules/customers/model/customer";
import {
  createCustomerRepository,
  CustomerRepositoryConflictError,
} from "@/server/modules/customers/repository/customer";
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

  it("clears only changed contact verification and rejects duplicate identities", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const Customer = getCustomerModel(client.connection);
    await Customer.syncIndexes();
    const passwordHash = await hashCustomerPassword("A strong customer passphrase 2026");
    const first = await Customer.create({
      firstName: "First",
      lastName: "Customer",
      mobile: "+351912345671",
      email: "first@example.com",
      passwordHash,
      mobileVerifiedAt: new Date(),
      emailVerifiedAt: new Date(),
    });
    await Customer.create({
      firstName: "Second",
      lastName: "Customer",
      mobile: "+351912345672",
      email: "second@example.com",
      passwordHash,
    });
    const repository = createCustomerRepository(client.connection);
    const actor = { kind: "customer", id: first._id.toHexString() } as const;
    const current = await repository.findById(actor.id);
    if (!current) throw new Error("Customer fixture was not persisted.");
    const renamed = await repository.saveProfile(
      current,
      {
        firstName: "Renamed",
        lastName: current.lastName,
        mobile: current.mobile,
        email: current.email,
        marketingConsent: true,
      },
      actor,
    );
    expect(renamed.mobileVerifiedAt).not.toBeNull();
    expect(renamed.emailVerifiedAt).not.toBeNull();
    const changed = await repository.saveProfile(
      renamed,
      {
        firstName: renamed.firstName,
        lastName: renamed.lastName,
        mobile: "+351912345673",
        email: "CHANGED@example.com",
        marketingConsent: false,
      },
      actor,
    );
    expect(changed.mobileVerifiedAt).toBeNull();
    expect(changed.emailVerifiedAt).toBeNull();
    expect(changed.email).toBe("changed@example.com");
    await expect(
      repository.saveProfile(
        changed,
        {
          firstName: changed.firstName,
          lastName: changed.lastName,
          mobile: "+351912345672",
          email: changed.email,
          marketingConsent: false,
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(CustomerRepositoryConflictError);
    await expect(
      repository.saveProfile(
        changed,
        {
          firstName: changed.firstName,
          lastName: changed.lastName,
          mobile: changed.mobile,
          email: "second@example.com",
          marketingConsent: false,
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(CustomerRepositoryConflictError);
  });
});
