import { Mongoose } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getAdminModel } from "@/server/modules/admins/model/admin";
import { hashAdminPassword } from "@/server/modules/admins/service/password";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

describe("persisted administrator constraints", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-admin-model-test");
    client = new Mongoose();
    await client.connect(database.uri);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("enforces normalized uniqueness across active and disabled administrators", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const Admin = getAdminModel(client.connection);
    await Admin.syncIndexes();
    const passwordHash = await hashAdminPassword("A strong admin passphrase 2026");
    const base = { firstName: "Sara", lastName: "Kazemi", role: "owner" as const, passwordHash };

    await Admin.create({ ...base, identifier: "  SARA@EXAMPLE.COM  ", active: false });
    await expect(
      Admin.create({ ...base, identifier: "sara@example.com", active: true }),
    ).rejects.toMatchObject({ code: 11_000 });

    await Admin.create({ ...base, identifier: "Kitchen.Admin", role: "manager" });
    await expect(Admin.create({ ...base, identifier: "kitchen.admin" })).rejects.toMatchObject({
      code: 11_000,
    });

    const stored = await Admin.findOne({ identifier: "sara@example.com" });
    expect(stored?.active).toBe(false);
    expect(stored?.passwordHash).toBeUndefined();
    expect(stored?.createdAt).toBeInstanceOf(Date);
    expect(stored?.updatedAt).toBeInstanceOf(Date);
    expect(
      await Admin.findOne({ identifier: "sara@example.com" }).select("+passwordHash"),
    ).toHaveProperty("passwordHash", passwordHash);
  });
});
