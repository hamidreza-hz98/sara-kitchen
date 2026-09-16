import argon2 from "argon2";
import { Mongoose } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getAdminModel } from "@/server/modules/admins/model/admin";
import { verifyAdminPasswordForLogin } from "@/server/modules/admins/service/password";
import { getCustomerModel } from "@/server/modules/customers/model/customer";
import { verifyCustomerPasswordForLogin } from "@/server/modules/customers/service/password";
import { isPasswordHash } from "@/server/security/password";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

describe("rehash on successful login", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;
  const password = "A secure login passphrase 2026";

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-password-upgrade-test");
    client = new Mongoose();
    await client.connect(database.uri);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  async function oldHash() {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 4096,
      timeCost: 1,
      parallelism: 1,
    });
  }

  it("upgrades an active admin digest but never persists or logs plaintext", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const Admin = getAdminModel(client.connection);
    const originalHash = await oldHash();
    const id = (
      await Admin.collection.insertOne({
        firstName: "Sara",
        lastName: "Kazemi",
        identifier: "sara",
        role: "owner",
        active: true,
        passwordHash: originalHash,
        passwordVersion: 1,
      })
    ).insertedId;
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      expect(await verifyAdminPasswordForLogin(client.connection, id, "wrong password")).toBe(
        false,
      );
      expect(await verifyAdminPasswordForLogin(client.connection, id, password)).toBe(true);
      expect(log).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
      warn.mockRestore();
      error.mockRestore();
    }
    const stored = await Admin.collection.findOne({ _id: id });
    expect(stored?.passwordHash).not.toBe(originalHash);
    expect(stored?.passwordHash).not.toContain(password);
    expect(isPasswordHash(stored?.passwordHash ?? "")).toBe(true);
    expect(stored?.passwordVersion).toBe(1);
    expect(JSON.stringify(stored)).not.toContain(password);
    await Admin.updateOne({ _id: id }, { $set: { active: false } });
    expect(await verifyAdminPasswordForLogin(client.connection, id, password)).toBe(false);
  });

  it("upgrades an active customer digest and refuses disabled accounts", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const Customer = getCustomerModel(client.connection);
    const originalHash = await oldHash();
    const id = (
      await Customer.collection.insertOne({
        firstName: "Sara",
        lastName: "Kazemi",
        mobile: "+351912345678",
        email: null,
        status: "active",
        passwordHash: originalHash,
        passwordVersion: 1,
      })
    ).insertedId;
    expect(await verifyCustomerPasswordForLogin(client.connection, id, "wrong password")).toBe(
      false,
    );
    expect(await verifyCustomerPasswordForLogin(client.connection, id, password)).toBe(true);
    const stored = await Customer.collection.findOne({ _id: id });
    expect(isPasswordHash(stored?.passwordHash ?? "")).toBe(true);
    expect(stored?.passwordHash).not.toContain(password);
    expect(stored?.passwordVersion).toBe(1);
    await Customer.updateOne({ _id: id }, { $set: { status: "disabled" } });
    expect(await verifyCustomerPasswordForLogin(client.connection, id, password)).toBe(false);
  });
});
