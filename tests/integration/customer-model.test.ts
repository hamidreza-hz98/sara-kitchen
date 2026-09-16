import { Mongoose } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getCustomerModel } from "@/server/modules/customers/model/customer";
import { hashCustomerPassword } from "@/server/modules/customers/service/password";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

describe("persisted customer identity constraints", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-customer-model-test");
    client = new Mongoose();
    await client.connect(database.uri);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("reserves normalized mobile and present email across disabled accounts", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const Customer = getCustomerModel(client.connection);
    await Customer.syncIndexes();
    const passwordHash = await hashCustomerPassword("A strong customer passphrase 2026");
    const base = { firstName: "Sara", lastName: "Kazemi", passwordHash };

    await Customer.create({
      ...base,
      mobile: "912 345 678",
      email: "  SARA@EXAMPLE.COM  ",
      status: "disabled",
    });
    await expect(Customer.create({ ...base, mobile: "+351912345678" })).rejects.toMatchObject({
      code: 11_000,
    });
    await expect(
      Customer.create({ ...base, mobile: "913456789", email: "sara@example.com" }),
    ).rejects.toMatchObject({ code: 11_000 });

    await Customer.create({ ...base, mobile: "913456789" });
    await Customer.create({ ...base, mobile: "914567890", email: "  " });
    expect(await Customer.countDocuments({ email: null })).toBe(2);

    const stored = await Customer.findOne({ mobile: "+351912345678" });
    expect(stored?.status).toBe("disabled");
    expect(stored?.passwordHash).toBeUndefined();
    expect(stored?.createdAt).toBeInstanceOf(Date);
    expect(stored?.updatedAt).toBeInstanceOf(Date);
    expect(
      await Customer.findOne({ mobile: "+351912345678" }).select("+passwordHash"),
    ).toHaveProperty("passwordHash", passwordHash);
  });
});
