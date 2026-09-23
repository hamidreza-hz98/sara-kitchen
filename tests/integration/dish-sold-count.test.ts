import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { withMongoTransaction } from "@/server/database/transaction-boundary";
import { getDishModel } from "@/server/modules/dishes/model/dish";
import { getDishSoldProjectionModel } from "@/server/modules/dishes/model/dish-sold-projection";
import { SoldCountProjectionError, createDishSoldCountProjector } from "@/server/modules/dishes";

import { startTestMongoReplicaSet, type TestMongoDatabase } from "../helpers/mongodb";

describe("dish sold-count projection", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoReplicaSet("sara-kitchen-dish-sold-count-test");
    client = new Mongoose();
    await client.connect(database.uri);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("applies completion, retries, partial refunds and cancellation exactly once", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const connection = client.connection;
    const Dish = getDishModel(connection);
    const dish = await new Dish({
      translations: [{ locale: "en", name: "Projection Fesenjan" }],
      basePriceCents: 2_200,
    }).save();
    const orderId = new Types.ObjectId().toHexString();
    const projector = createDishSoldCountProjector(connection);
    const project = (revision: number, refundedQuantity: number, state = "completed" as const) =>
      withMongoTransaction(connection, (session) =>
        projector.project(
          {
            orderId,
            revision,
            fulfillmentState: state,
            paymentState: refundedQuantity === 4 ? "refunded" : "partially_refunded",
            items: [{ dishId: dish._id.toHexString(), quantity: 4, refundedQuantity }],
          },
          session,
        ),
      );

    await expect(project(1, 0)).resolves.toMatchObject({
      status: "changed",
      deltas: [{ delta: 4 }],
    });
    await expect(project(1, 0)).resolves.toMatchObject({ status: "duplicate", deltas: [] });
    expect((await Dish.findById(dish._id).lean())?.soldCount).toBe(4);

    await expect(project(2, 1)).resolves.toMatchObject({
      status: "changed",
      deltas: [{ delta: -1 }],
    });
    expect((await Dish.findById(dish._id).lean())?.soldCount).toBe(3);

    await expect(project(3, 4)).resolves.toMatchObject({
      status: "changed",
      deltas: [{ delta: -3 }],
    });
    await expect(project(3, 4)).resolves.toMatchObject({ status: "duplicate", deltas: [] });
    expect((await Dish.findById(dish._id).lean())?.soldCount).toBe(0);

    await expect(project(2, 1)).resolves.toMatchObject({ status: "stale", revision: 3 });
    expect((await Dish.findById(dish._id).lean())?.soldCount).toBe(0);
  });

  it("rejects conflicting retries and rolls all dish deltas back on failure", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const Dish = getDishModel(client.connection);
    const Projection = getDishSoldProjectionModel(client.connection);
    const validDish = await new Dish({
      translations: [{ locale: "en", name: "Projection Zereshk Polo" }],
      basePriceCents: 1_800,
    }).save();
    const missingDishId = new Types.ObjectId().toHexString();
    const orderId = new Types.ObjectId().toHexString();
    const projector = createDishSoldCountProjector(client.connection);

    const snapshot = {
      orderId,
      revision: 1,
      fulfillmentState: "completed" as const,
      paymentState: "paid" as const,
      items: [{ dishId: validDish._id.toHexString(), quantity: 2 }],
    };
    await withMongoTransaction(client.connection, (session) =>
      projector.project(snapshot, session),
    );
    await expect(
      withMongoTransaction(client.connection, (session) =>
        projector.project(
          { ...snapshot, items: [{ dishId: validDish._id.toHexString(), quantity: 3 }] },
          session,
        ),
      ),
    ).rejects.toMatchObject({ code: "revision_conflict" });
    expect((await Dish.findById(validDish._id).lean())?.soldCount).toBe(2);

    await expect(
      withMongoTransaction(client.connection, (session) =>
        projector.project(
          {
            ...snapshot,
            revision: 2,
            items: [
              { dishId: validDish._id.toHexString(), quantity: 5 },
              { dishId: missingDishId, quantity: 1 },
            ],
          },
          session,
        ),
      ),
    ).rejects.toMatchObject({ code: "dish_not_found" });
    expect((await Dish.findById(validDish._id).lean())?.soldCount).toBe(2);
    expect((await Projection.findOne({ orderId }).lean())?.sourceRevision).toBe(1);
  });

  it("refuses to write outside the owning order transaction", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const session = await client.connection.startSession();
    const projector = createDishSoldCountProjector(client.connection);
    await expect(
      projector.project(
        {
          orderId: new Types.ObjectId().toHexString(),
          revision: 1,
          fulfillmentState: "completed",
          paymentState: "paid",
          items: [{ dishId: new Types.ObjectId().toHexString(), quantity: 1 }],
        },
        session,
      ),
    ).rejects.toBeInstanceOf(SoldCountProjectionError);
    await session.endSession();
  });
});
