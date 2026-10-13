import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getDishModel } from "@/server/modules/dishes/model/dish";
import { createDishRecommendationRepository } from "@/server/modules/dishes/repository/recommendations";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

const NOW = new Date("2026-10-13T12:00:00.000Z");

describe("dish recommendation repository", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;
  const sourceId = new Types.ObjectId();
  const relatedId = new Types.ObjectId();
  const categoryId = new Types.ObjectId();
  const featuredId = new Types.ObjectId();
  const unavailableId = new Types.ObjectId();
  const draftId = new Types.ObjectId();
  const sharedCategoryId = new Types.ObjectId();

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-recommendations-test");
    client = new Mongoose();
    await client.connect(database.uri);
    const Dish = getDishModel(client.connection);
    await Dish.init();
    const base = {
      translations: [{ locale: "en" as const, name: "Recommendation fixture" }],
      basePriceCents: 1_000,
      status: "published" as const,
    };
    await Dish.create([
      {
        ...base,
        _id: sourceId,
        slug: "recommendation-source",
        categoryIds: [sharedCategoryId],
        relatedDishIds: [relatedId, unavailableId, draftId],
      },
      { ...base, _id: relatedId, slug: "related-candidate", availability: { mode: "available" } },
      {
        ...base,
        _id: categoryId,
        slug: "category-candidate",
        categoryIds: [sharedCategoryId],
        availability: { mode: "available" },
      },
      {
        ...base,
        _id: featuredId,
        slug: "featured-candidate",
        isFeatured: true,
        featuredOrder: 1,
        availability: { mode: "available" },
      },
      {
        ...base,
        _id: unavailableId,
        slug: "unavailable-candidate",
        categoryIds: [sharedCategoryId],
        isFeatured: true,
        availability: { mode: "unavailable" },
      },
      {
        ...base,
        _id: draftId,
        slug: "draft-candidate",
        status: "draft",
        categoryIds: [sharedCategoryId],
        isFeatured: true,
      },
    ]);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("returns bounded public pools while excluding current, unavailable, and unpublished dishes", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const repository = createDishRecommendationRepository(client.connection);
    const sources = await repository.findSources([sourceId.toHexString()]);
    expect(sources).toEqual([
      {
        id: sourceId.toHexString(),
        categoryIds: [sharedCategoryId.toHexString()],
        relatedDishIds: [
          relatedId.toHexString(),
          unavailableId.toHexString(),
          draftId.toHexString(),
        ],
      },
    ]);

    const pools = await repository.findCandidates({
      at: NOW,
      categoryIds: [sharedCategoryId.toHexString()],
      excludeDishIds: [sourceId.toHexString()],
      poolSize: 6,
      relatedDishIds: sources[0]?.relatedDishIds ?? [],
    });
    expect(pools.related.map(({ id }) => id)).toEqual([relatedId.toHexString()]);
    expect(pools.category.map(({ id }) => id)).toEqual([categoryId.toHexString()]);
    expect(pools.featured.map(({ id }) => id)).toEqual([featuredId.toHexString()]);
    expect(JSON.stringify(pools)).not.toContain(sourceId.toHexString());
    expect(JSON.stringify(pools)).not.toContain(unavailableId.toHexString());
    expect(JSON.stringify(pools)).not.toContain(draftId.toHexString());
  });
});
