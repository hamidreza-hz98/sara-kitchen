import "server-only";

import type { Connection } from "mongoose";

import {
  SETTINGS_COLLECTION,
  SETTINGS_SCHEMA_VERSION,
  SETTINGS_SECTION_REGISTRY,
  isSettingsSectionKey,
} from "../model/settings-section";

type RawSettingsDocument = Record<string, unknown>;
type SettingsMigration = (document: RawSettingsDocument) => RawSettingsDocument;

export type SettingsMigrationErrorCode =
  | "invalid_document"
  | "unknown_key"
  | "invalid_version"
  | "future_version"
  | "missing_migration"
  | "write_conflict";

export class SettingsMigrationError extends Error {
  constructor(
    readonly code: SettingsMigrationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SettingsMigrationError";
  }
}

const migrateVersion1To2: SettingsMigration = (document) => {
  const key = document.key;
  if (!isSettingsSectionKey(key)) {
    throw new SettingsMigrationError("unknown_key", "Settings migration received an unknown key.");
  }
  return {
    ...document,
    publicationPolicy: SETTINGS_SECTION_REGISTRY[key].publicationPolicy,
    schemaVersion: 2,
  };
};

const MIGRATIONS = new Map<number, SettingsMigration>([[1, migrateVersion1To2]]);

export type SettingsMigrationResult = Readonly<{
  document: RawSettingsDocument;
  fromVersion: number;
  migrated: boolean;
  toVersion: number;
}>;

export function migrateSettingsSectionDocument(input: unknown): SettingsMigrationResult {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new SettingsMigrationError("invalid_document", "Settings migration requires a document.");
  }
  let document = { ...(input as RawSettingsDocument) };
  if (!isSettingsSectionKey(document.key)) {
    throw new SettingsMigrationError("unknown_key", "Settings migration received an unknown key.");
  }
  const version = document.schemaVersion;
  if (!Number.isSafeInteger(version) || (version as number) < 1) {
    throw new SettingsMigrationError(
      "invalid_version",
      "Settings migration requires a positive schema version.",
    );
  }
  const fromVersion = version as number;
  const targetVersion = SETTINGS_SECTION_REGISTRY[document.key].schemaVersion;
  if (fromVersion > targetVersion) {
    throw new SettingsMigrationError(
      "future_version",
      "Settings document was written by a newer application version.",
    );
  }

  let currentVersion = fromVersion;
  while (currentVersion < targetVersion) {
    const migration = MIGRATIONS.get(currentVersion);
    if (!migration) {
      throw new SettingsMigrationError(
        "missing_migration",
        `No settings migration exists from schema version ${currentVersion}.`,
      );
    }
    document = migration(document);
    const nextVersion = document.schemaVersion;
    if (nextVersion !== currentVersion + 1) {
      throw new SettingsMigrationError(
        "invalid_version",
        "Settings migrations must advance exactly one schema version.",
      );
    }
    currentVersion = nextVersion;
  }

  return {
    document,
    fromVersion,
    toVersion: currentVersion,
    migrated: currentVersion !== fromVersion,
  };
}

export type SettingsMigrationRunResult = Readonly<{
  inspected: number;
  migrated: number;
  planned: boolean;
}>;

export async function migrateSettingsSectionDocuments(
  connection: Connection,
  options: Readonly<{ apply: boolean }>,
): Promise<SettingsMigrationRunResult> {
  const collection = connection.collection(SETTINGS_COLLECTION);
  const documents = await collection.find({}).toArray();
  const plans = documents.map((stored) => ({
    result: migrateSettingsSectionDocument(stored),
    stored,
  }));
  const pending = plans.filter(({ result }) => result.migrated);

  if (options.apply) {
    for (const { result, stored } of pending) {
      const write = await collection.replaceOne(
        { _id: stored._id, schemaVersion: result.fromVersion },
        { ...result.document, _id: stored._id },
      );
      if (write.modifiedCount !== 1) {
        throw new SettingsMigrationError(
          "write_conflict",
          "Settings migration lost an optimistic write race.",
        );
      }
    }
  }

  return { inspected: documents.length, migrated: pending.length, planned: !options.apply };
}

export { SETTINGS_SCHEMA_VERSION };
