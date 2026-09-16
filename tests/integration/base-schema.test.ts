import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createMongoConnectionCache,
  createMongoConnectionManager,
} from "@/server/database/connection-manager";
import {
  ACTIVE_DOCUMENT_FILTER,
  createActorMetadata,
  createBaseSchema,
  type BaseDocumentFields,
  type NormalizedSearchFields,
  type SoftDeleteFields,
} from "@/server/database/schema";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

type PersistedFixture = BaseDocumentFields &
  SoftDeleteFields &
  NormalizedSearchFields & {
    name: string;
  };

describe("persisted base schema conventions", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-base-schema-test");
    client = new Mongoose();
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("persists timestamps and internal search data while exposing stable JSON", async () => {
    const testClient = client;
    const testDatabase = database;
    if (!testClient || !testDatabase) throw new Error("Test MongoDB did not start.");

    const manager = createMongoConnectionManager({
      cache: createMongoConnectionCache(),
      getUri: () => testDatabase.uri,
      mongooseClient: testClient,
    });
    const connection = await manager.connect();
    const schema = createBaseSchema<PersistedFixture>(
      { name: { type: String, required: true } },
      { schemaVersion: 2, searchSourcePaths: ["name"], softDelete: true },
    );
    const FixtureModel = connection.model<PersistedFixture>("BaseSchemaIntegrationFixture", schema);
    const actorId = new Types.ObjectId();
    const fixture = await FixtureModel.create({
      createdBy: createActorMetadata("admin", actorId),
      name: "Arroz Açafrão زعفرانی",
    });

    expect(fixture.createdAt).toBeInstanceOf(Date);
    expect(fixture.updatedAt).toBeInstanceOf(Date);
    expect(fixture.schemaVersion).toBe(2);
    expect(fixture.normalizedSearchText).toBe("arroz acafrao زعفرانی");

    const ordinaryRead = await FixtureModel.findById(fixture._id).lean().exec();
    expect(ordinaryRead).not.toHaveProperty("normalizedSearchText");
    const searchRead = await FixtureModel.findById(fixture._id)
      .select("+normalizedSearchText")
      .lean()
      .exec();
    expect(searchRead?.normalizedSearchText).toBe("arroz acafrao زعفرانی");

    const serialized = fixture.toJSON() as Record<string, unknown>;
    expect(serialized.id).toBe(fixture._id.toHexString());
    expect(serialized).not.toHaveProperty("_id");
    expect(serialized).not.toHaveProperty("__v");
    expect(serialized).not.toHaveProperty("normalizedSearchText");
    expect(serialized).toHaveProperty("createdBy.actorId", actorId.toHexString());

    fixture.deletedAt = new Date();
    fixture.deletedBy = createActorMetadata("admin", actorId);
    await fixture.save();
    expect(await FixtureModel.countDocuments(ACTIVE_DOCUMENT_FILTER)).toBe(0);
    expect(await FixtureModel.countDocuments({})).toBe(1);

    await manager.disconnect();
  });
});
