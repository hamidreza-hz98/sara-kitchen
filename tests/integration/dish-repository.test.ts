import { Mongoose } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createDishRepository,
  type DishSnapshot,
  type DishWrite,
} from "@/server/modules/dishes/repository/dish";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

const actorId = "a".repeat(24);

function write(name: string, slug: string, relatedDishIds: readonly string[] = []): DishWrite {
  return {
    translations: [
      {
        locale: "en",
        name,
        excerpt: "",
        description: null,
        specifications: [],
      },
    ],
    slug,
    mediaIds: [],
    categoryIds: [],
    ingredients: [],
    basePriceCents: 1_000,
    discount: {
      type: "none",
      amountCents: null,
      basisPoints: null,
      startsAt: null,
      endsAt: null,
    },
    portionAmount: 1,
    portionUnit: "serving",
    availability: { mode: "available", availableFrom: null, availableUntil: null },
    leadTimeMinutes: 0,
    maxQuantityPerOrder: 10,
    mayContainAllergenTags: [],
    dietaryTags: [],
    isFeatured: false,
    featuredOrder: 0,
    relatedDishIds,
    relatedBlogIds: [],
    status: "draft",
  };
}

function writable(snapshot: DishSnapshot, status = snapshot.status): DishWrite {
  return {
    translations: snapshot.translations,
    slug: snapshot.slug,
    mediaIds: snapshot.mediaIds,
    categoryIds: snapshot.categoryIds,
    ingredients: snapshot.ingredients,
    basePriceCents: snapshot.basePriceCents,
    discount: snapshot.discount,
    portionAmount: snapshot.portionAmount,
    portionUnit: snapshot.portionUnit,
    availability: snapshot.availability,
    leadTimeMinutes: snapshot.leadTimeMinutes,
    maxQuantityPerOrder: snapshot.maxQuantityPerOrder,
    mayContainAllergenTags: snapshot.mayContainAllergenTags,
    dietaryTags: snapshot.dietaryTags,
    isFeatured: snapshot.isFeatured,
    featuredOrder: snapshot.featuredOrder,
    relatedDishIds: snapshot.relatedDishIds,
    relatedBlogIds: snapshot.relatedBlogIds,
    status,
  };
}

describe("Dish repository", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-dish-repository-test");
    client = new Mongoose();
    await client.connect(database.uri);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("detects transitive cycles and removes inbound relations for archived dishes", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const repository = createDishRepository(client.connection);
    const target = await repository.create(write("Fesenjan", "fesenjan"), actorId);
    const source = await repository.create(
      write("Ghormeh Sabzi", "ghormeh-sabzi", [target.id]),
      actorId,
    );

    await expect(repository.wouldCreateRelationshipCycle(target.id, [source.id])).resolves.toBe(
      true,
    );
    await repository.save(target, writable(target, "archived"), actorId);
    await expect(repository.removeInboundRelationships(target.id, actorId)).resolves.toEqual([
      source.id,
    ]);
    await expect(repository.findById(source.id)).resolves.toMatchObject({ relatedDishIds: [] });
  });
});
