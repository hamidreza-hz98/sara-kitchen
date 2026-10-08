import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createAddressRepository } from "@/server/modules/addresses/repository/address";
import { getAddressModel } from "@/server/modules/addresses/model/address";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

const value = (name: string, isDefault = false) => ({
  name,
  recipientName: "Sara Kazemi",
  recipientMobile: "+351912345678",
  formattedAddress: `${name}, Porto`,
  location: { type: "Point" as const, coordinates: [-8.606, 41.1496] as [number, number] },
  postalCode: "4000-008",
  deliveryNotes: null,
  isDefault,
});

describe("address CRUD repository", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-address-crud-test");
    client = new Mongoose();
    await client.connect(database.uri);
    await getAddressModel(client.connection).init();
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("keeps ownership isolated and maintains exactly one default", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const repository = createAddressRepository(client.connection);
    const ownerId = new Types.ObjectId().toHexString();
    const otherId = new Types.ObjectId().toHexString();

    const home = await repository.create(ownerId, value("Home"), ownerId);
    expect(home.isDefault).toBe(true);
    expect(await repository.findOwnedById(otherId, home.id)).toBeNull();

    const work = await repository.create(ownerId, value("Work", true), ownerId);
    expect(work.isDefault).toBe(true);
    expect((await repository.findOwnedById(ownerId, home.id))?.isDefault).toBe(false);

    const updated = await repository.save(work, { formattedAddress: "Boavista, Porto" }, ownerId);
    expect(updated.validation.status).toBe("unverified");

    await repository.softDelete(updated, ownerId, new Date());
    const remaining = await repository.listForCustomer(ownerId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({ id: home.id, isDefault: true });
  });
});
