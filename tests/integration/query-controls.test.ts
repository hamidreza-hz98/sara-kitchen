import { Mongoose, Schema } from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import englishMessages from "@/locales/messages/en/validation.json";
import { createListQueryControls, pageResult } from "@/server/database/query-controls";
import type { ValidationMessageTranslator } from "@/validations/request";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

const translate: ValidationMessageTranslator = (key) => englishMessages[key];

describe("list query controls with MongoDB", () => {
  let database: TestMongoDatabase;
  let client: Mongoose;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-query-controls-test");
    client = new Mongoose();
    await client.connect(database.uri);
  }, 120_000);

  afterAll(async () => {
    await client?.disconnect();
    await database?.stop();
  });

  it("paginates ties once, filters/searches, and projects no secret fields", async () => {
    const schema = new Schema({
      name: String,
      status: String,
      normalizedSearchText: String,
      secret: String,
    });
    const Dish = client.model("QueryControlsDish", schema);
    await Dish.insertMany([
      { name: "Soup", status: "active", normalizedSearchText: "soup", secret: "hidden" },
      { name: "Soup", status: "active", normalizedSearchText: "soup barley", secret: "hidden" },
      { name: "Soup", status: "draft", normalizedSearchText: "soup beans", secret: "hidden" },
    ]);
    const controls = createListQueryControls({
      filters: { status: z.enum(["active", "draft"]) },
      sortFields: ["name"],
      defaultSort: "name",
      projectionFields: ["name", "status"],
      defaultProjection: ["name"],
      search: true,
    });
    const ids: string[] = [];
    for (const page of [1, 2]) {
      const plan = controls.parse(
        new URLSearchParams(`page=${page}&pageSize=1&status=active&search=soup`),
        { translate },
      );
      const [items, total] = await Promise.all([
        Dish.find(plan.filter)
          .select(plan.projection)
          .sort(plan.sort)
          .skip(plan.skip)
          .limit(plan.limit)
          .lean()
          .exec(),
        Dish.countDocuments(plan.filter).exec(),
      ]);
      const result = pageResult(items, total, plan);
      expect(result.meta.pagination.totalItems).toBe(2);
      expect(result.meta.pagination.hasNextPage).toBe(page === 1);
      expect(items).toHaveLength(1);
      expect(items[0]).not.toHaveProperty("secret");
      ids.push(String(items[0]?._id));
    }
    expect(new Set(ids).size).toBe(2);
  });
});
