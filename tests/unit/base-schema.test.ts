import { model, models, Types } from "mongoose";
import { describe, expect, it } from "vitest";

import {
  ACTIVE_DOCUMENT_FILTER,
  createActorMetadata,
  createBaseSchema,
  normalizeSearchText,
  type BaseDocumentFields,
  type NormalizedSearchFields,
  type SoftDeleteFields,
} from "@/server/database/schema";

type Fixture = BaseDocumentFields &
  SoftDeleteFields &
  NormalizedSearchFields & {
    code: number;
    localizedNames: string[];
    name: string;
  };

function createFixtureModel(name: string, softDelete = true) {
  const schema = createBaseSchema<Fixture>(
    {
      code: { type: Number, required: true },
      localizedNames: { type: [String], default: [] },
      name: { type: String, required: true },
    },
    {
      schemaVersion: 3,
      searchSourcePaths: ["name", "localizedNames", "code"],
      softDelete,
    },
  );
  return { schema, FixtureModel: models[name] ?? model<Fixture>(name, schema) };
}

describe("base schema conventions", () => {
  it("normalizes Latin, Portuguese, Persian, Arabic, digits, and spacing deterministically", () => {
    expect(normalizeSearchText("  Crème   PORTO—كِباب ۱۲٣  ")).toBe("creme porto کباب 123");
  });

  it("configures identifiers, timestamps, versioning, actor fields, soft delete, and search", async () => {
    const { FixtureModel, schema } = createFixtureModel("BaseSchemaUnitFixture");
    const actorId = new Types.ObjectId();
    const fixture = new FixtureModel({
      code: 42,
      createdBy: createActorMetadata("admin", actorId),
      localizedNames: ["قیمه‌ی ۱۲", "Creme"],
      name: "Crème كِباب",
      updatedBy: createActorMetadata("system"),
    });

    await fixture.validate();

    expect(fixture._id).toBeInstanceOf(Types.ObjectId);
    expect(schema.options.timestamps).toBe(true);
    expect(schema.options.optimisticConcurrency).toBe(true);
    expect(fixture.schemaVersion).toBe(3);
    expect(fixture.deletedAt).toBeNull();
    expect(fixture.normalizedSearchText).toBe("creme کباب قیمهی 12 creme 42");
    expect(schema.path("normalizedSearchText").options.select).toBe(false);
    expect(schema.indexes()).toEqual(
      expect.arrayContaining([
        [{ deletedAt: 1 }, expect.any(Object)],
        [{ normalizedSearchText: 1 }, expect.any(Object)],
      ]),
    );
  });

  it("adds soft-delete fields only when the entity opts in", () => {
    const { schema } = createFixtureModel("BaseSchemaHardDeleteUnitFixture", false);
    expect(schema.path("deletedAt")).toBeUndefined();
    expect(schema.path("deletedBy")).toBeUndefined();
    expect(ACTIVE_DOCUMENT_FILTER).toEqual({ deletedAt: null });
  });

  it("requires actor identifiers for people and allows system actors without one", async () => {
    expect(() => createActorMetadata("customer", "not-an-object-id")).toThrow(TypeError);
    expect(createActorMetadata("system")).toEqual({ kind: "system" });

    const { FixtureModel } = createFixtureModel("BaseSchemaActorUnitFixture");
    const fixture = new FixtureModel({
      code: 1,
      createdBy: { kind: "admin" },
      name: "Actor validation",
    });
    await expect(fixture.validate()).rejects.toThrow(/actorId/u);
  });

  it("requires soft-delete timestamp and actor provenance together", async () => {
    const { FixtureModel } = createFixtureModel("BaseSchemaSoftDeleteUnitFixture");
    const fixture = new FixtureModel({ code: 1, name: "Soft delete validation" });
    fixture.deletedAt = new Date();
    await expect(fixture.validate()).rejects.toThrow(/deletedBy/u);

    fixture.deletedBy = createActorMetadata("system");
    await expect(fixture.validate()).resolves.toBeUndefined();
  });

  it("serializes a stable id, nested actor ids, and no persistence internals", async () => {
    const { FixtureModel } = createFixtureModel("BaseSchemaJsonUnitFixture");
    const actorId = new Types.ObjectId();
    const fixture = new FixtureModel({
      code: 7,
      createdBy: createActorMetadata("admin", actorId),
      name: "JSON fixture",
    });
    await fixture.validate();
    fixture.$set("__v", 4);

    const serialized = fixture.toJSON() as Record<string, unknown>;
    expect(serialized.id).toBe(fixture._id.toHexString());
    expect(serialized).not.toHaveProperty("_id");
    expect(serialized).not.toHaveProperty("__v");
    expect(serialized).not.toHaveProperty("normalizedSearchText");
    expect(serialized).toHaveProperty("createdBy.actorId", actorId.toHexString());
  });

  it("rejects invalid convention options", () => {
    expect(() => createBaseSchema({}, { schemaVersion: 0 })).toThrow(RangeError);
    expect(() => createBaseSchema({}, { searchSourcePaths: [" "] })).toThrow(TypeError);
  });
});
