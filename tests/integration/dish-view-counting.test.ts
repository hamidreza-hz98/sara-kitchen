import { Mongoose } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getDishModel, getDishViewReceiptModel } from "@/server/modules/dishes";
import { evaluateDishViewSignal } from "@/server/modules/dishes/policy/dish-view";
import { createDishViewRepository } from "@/server/modules/dishes/repository/dish-view";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

const secret = "dish-view-integration-secret-at-least-32-characters";
const at = new Date("2026-09-23T12:00:00.000Z");

describe("dish view persistence", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-dish-view-test");
    client = new Mongoose();
    await client.connect(database.uri);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("counts one refresh-spam burst once and allows a later window", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const Dish = getDishModel(client.connection);
    const Receipt = getDishViewReceiptModel(client.connection);
    await Promise.all([Dish.init(), Receipt.init()]);
    const dish = await Dish.create({
      translations: [{ locale: "en", name: "View-count Fesenjan" }],
      basePriceCents: 1_200,
      status: "published",
    });
    const signal = {
      dishId: dish._id.toHexString(),
      userAgent: "Mozilla/5.0 integration browser",
      clientAddress: "192.0.2.44",
      engagementMs: 4_000,
      visibilityState: "visible" as const,
    };
    const decision = evaluateDishViewSignal(signal, { secret, at });
    if (!decision.countable) throw new Error("Fixture must be countable.");
    const repository = createDishViewRepository(client.connection);
    const results = await Promise.all(
      Array.from({ length: 20 }, () => repository.count(decision.candidate)),
    );
    expect(results.filter((result) => result === "counted")).toHaveLength(1);
    expect(results.filter((result) => result === "duplicate")).toHaveLength(19);
    expect((await Dish.findById(dish._id))?.viewCount).toBe(1);

    const later = evaluateDishViewSignal(signal, {
      secret,
      at: new Date(at.getTime() + 6 * 60 * 60 * 1_000),
    });
    if (!later.countable) throw new Error("Later fixture must be countable.");
    await expect(repository.count(later.candidate)).resolves.toBe("counted");
    expect((await Dish.findById(dish._id))?.viewCount).toBe(2);
  });

  it("does not count draft or missing dishes and releases their claims", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const Dish = getDishModel(client.connection);
    const dish = await Dish.create({
      translations: [{ locale: "en", name: "Draft view dish" }],
      basePriceCents: 900,
      status: "draft",
    });
    const decision = evaluateDishViewSignal(
      {
        dishId: dish._id.toHexString(),
        userAgent: "Mozilla/5.0 draft browser",
        clientAddress: "192.0.2.45",
        engagementMs: 4_000,
        visibilityState: "visible",
      },
      { secret, at },
    );
    if (!decision.countable) throw new Error("Fixture must be countable.");
    const repository = createDishViewRepository(client.connection);
    await expect(repository.count(decision.candidate)).resolves.toBe("dish_unavailable");
    await expect(repository.count(decision.candidate)).resolves.toBe("dish_unavailable");
    expect((await Dish.findById(dish._id))?.viewCount).toBe(0);
  });
});
