import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { CART_INDEX_NAMES } from "@/server/modules/carts";
import { getCartModel } from "@/server/modules/carts/model/cart";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

describe("cart persistence invariants", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-cart-model-test");
    client = new Mongoose();
    await client.connect(database.uri);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("enforces one active cart per guest and customer while allowing terminal history", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const Cart = getCartModel(client.connection);
    await Cart.syncIndexes();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60_000);
    const absoluteExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60_000);
    const purgeAt = new Date(Date.now() + 120 * 24 * 60 * 60_000);
    const guestTokenHash = "c".repeat(64);
    const customerId = new Types.ObjectId();

    await new Cart({ guestTokenHash, expiresAt, absoluteExpiresAt }).save();
    await expect(
      new Cart({ guestTokenHash, expiresAt, absoluteExpiresAt }).save(),
    ).rejects.toMatchObject({ code: 11000 });

    await new Cart({ customerId, expiresAt }).save();
    await expect(new Cart({ customerId, expiresAt }).save()).rejects.toMatchObject({ code: 11000 });

    await new Cart({
      guestTokenHash: "d".repeat(64),
      expiresAt,
      absoluteExpiresAt,
      status: "expired",
      purgeAt,
    }).save();
    await expect(
      new Cart({
        guestTokenHash: "d".repeat(64),
        expiresAt,
        absoluteExpiresAt,
      }).save(),
    ).resolves.toBeDefined();

    const indexes = await Cart.collection.indexes();
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: CART_INDEX_NAMES.activeGuest, unique: true }),
        expect.objectContaining({ name: CART_INDEX_NAMES.activeCustomer, unique: true }),
        expect.objectContaining({
          name: CART_INDEX_NAMES.terminalPurge,
          expireAfterSeconds: 0,
        }),
      ]),
    );
  });

  it("omits guest digests from ordinary reads and rejects TTL on active carts", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const Cart = getCartModel(client.connection);
    const stored = await Cart.findOne({ status: "active", guestTokenHash: { $exists: true } });
    expect(stored?.guestTokenHash).toBeUndefined();

    await expect(
      new Cart({
        guestTokenHash: "e".repeat(64),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000),
        absoluteExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60_000),
        purgeAt: new Date(Date.now() + 120 * 24 * 60 * 60_000),
      }).save(),
    ).rejects.toMatchObject({
      errors: expect.objectContaining({ purgeAt: expect.anything() }),
    });
  });
});
