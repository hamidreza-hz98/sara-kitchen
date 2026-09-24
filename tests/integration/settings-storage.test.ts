import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  SETTINGS_COLLECTION,
  SETTINGS_SCHEMA_VERSION,
  getSettingsSectionModel,
  migrateSettingsSectionDocuments,
} from "@/server/modules/settings";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

const editedAt = new Date("2026-09-24T12:00:00.000Z");
const editor = new Types.ObjectId();

function snapshot(published: boolean) {
  return {
    revision: 1,
    translations: [{ locale: "en", value: { title: "Sara Kitchen" } }],
    data: {},
    editedByAdminId: editor,
    editedAt,
    publishedAt: published ? editedAt : null,
  };
}

describe("settings storage", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-settings-storage-test");
    client = new Mongoose();
    await client.connect(database.uri);
    await getSettingsSectionModel(client.connection).init();
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("enforces one document per approved section key", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const SettingsSection = getSettingsSectionModel(client.connection);
    await new SettingsSection({
      key: "homepage",
      publicationPolicy: "staged",
      draft: snapshot(false),
    }).save();

    await expect(
      new SettingsSection({
        key: "homepage",
        publicationPolicy: "staged",
        draft: snapshot(false),
      }).save(),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("plans and atomically applies old section-shape migrations", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const collection = client.connection.collection(SETTINGS_COLLECTION);
    await collection.insertOne({
      key: "contact",
      schemaVersion: 1,
      draft: null,
      published: snapshot(true),
      createdBy: null,
      updatedBy: null,
      createdAt: editedAt,
      updatedAt: editedAt,
    });

    await expect(
      migrateSettingsSectionDocuments(client.connection, { apply: false }),
    ).resolves.toEqual({ inspected: 2, migrated: 1, planned: true });
    expect(await collection.findOne({ key: "contact" })).not.toHaveProperty("publicationPolicy");

    await expect(
      migrateSettingsSectionDocuments(client.connection, { apply: true }),
    ).resolves.toEqual({ inspected: 2, migrated: 1, planned: false });
    const migrated = await getSettingsSectionModel(client.connection).findOne({ key: "contact" });
    expect(migrated).toMatchObject({
      key: "contact",
      publicationPolicy: "direct",
      schemaVersion: SETTINGS_SCHEMA_VERSION,
    });
    await expect(migrated?.validate()).resolves.toBeUndefined();

    await expect(
      migrateSettingsSectionDocuments(client.connection, { apply: true }),
    ).resolves.toEqual({ inspected: 2, migrated: 0, planned: false });
  });

  it("validates the complete plan before applying any document", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const collection = client.connection.collection(SETTINGS_COLLECTION);
    await collection.insertMany([
      {
        key: "about",
        schemaVersion: 1,
        draft: snapshot(false),
        published: null,
      },
      {
        key: "unknown-section",
        schemaVersion: 1,
        draft: snapshot(false),
        published: null,
      },
    ]);

    await expect(
      migrateSettingsSectionDocuments(client.connection, { apply: true }),
    ).rejects.toMatchObject({ code: "unknown_key" });
    expect(await collection.findOne({ key: "about" })).toMatchObject({ schemaVersion: 1 });
    await collection.deleteMany({ key: { $in: ["about", "unknown-section"] } });
  });
});
