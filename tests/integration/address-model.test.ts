import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getAddressModel } from "@/server/modules/addresses/model/address";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

describe("address persistence invariants", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-address-model-test");
    client = new Mongoose();
    await client.connect(database.uri);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("enforces one active default for each customer without sharing ownership", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const Address = getAddressModel(client.connection);
    await Address.init();
    const ownerId = new Types.ObjectId();
    const otherOwnerId = new Types.ObjectId();
    const actor = { kind: "customer" as const, actorId: ownerId };
    const value = {
      name: "Home",
      recipientName: "Sara Kazemi",
      recipientMobile: "+351912345678",
      formattedAddress: "Rua de Santa Catarina 100, Porto",
      location: { type: "Point" as const, coordinates: [-8.606, 41.1496] },
      postalCode: "4000-008",
      isDefault: true,
    };

    const first = await new Address({ ...value, customerId: ownerId }).save();
    await expect(
      new Address({ ...value, name: "Work", customerId: ownerId }).save(),
    ).rejects.toMatchObject({
      code: 11000,
    });
    await expect(new Address({ ...value, customerId: otherOwnerId }).save()).resolves.toBeDefined();

    first.deletedAt = new Date();
    first.deletedBy = actor;
    await first.save();
    await expect(
      new Address({ ...value, name: "New home", customerId: ownerId }).save(),
    ).resolves.toBeDefined();
    expect(
      await Address.countDocuments({ customerId: ownerId, isDefault: true, deletedAt: null }),
    ).toBe(1);
  });
});
