import { existsSync } from "node:fs";
import { join } from "node:path";

import { MongoMemoryReplSet, MongoMemoryServer } from "mongodb-memory-server-core";

export interface TestMongoDatabase {
  uri: string;
  stop: () => Promise<void>;
}

function resolveMongoBinary() {
  const configuredBinary = process.env.MONGOMS_SYSTEM_BINARY?.trim();
  if (configuredBinary) return { systemBinary: configuredBinary };

  if (process.platform === "win32") {
    const programFiles = process.env.ProgramFiles;
    if (programFiles) {
      const standardBinary = join(programFiles, "MongoDB", "Server", "8.0", "bin", "mongod.exe");
      if (existsSync(standardBinary)) return { systemBinary: standardBinary };
    }
  }

  return { version: "8.0.26" };
}

export async function startTestMongoDatabase(
  databaseName = "sara-kitchen-test",
): Promise<TestMongoDatabase> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to start an in-memory MongoDB server in production.");
  }

  const server = await MongoMemoryServer.create({
    // The fallback is a published archive version and is intentionally
    // independent from the local Docker image maintenance tag.
    binary: resolveMongoBinary(),
    instance: { dbName: databaseName },
  });

  return {
    uri: server.getUri(),
    stop: async () => {
      await server.stop();
    },
  };
}

/** Real replica-set topology for multi-collection transaction tests. */
export async function startTestMongoReplicaSet(
  databaseName = "sara-kitchen-transaction-test",
): Promise<TestMongoDatabase> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to start an in-memory MongoDB replica set in production.");
  }

  const replicaSet = await MongoMemoryReplSet.create({
    binary: resolveMongoBinary(),
    replSet: { count: 1, storageEngine: "wiredTiger", dbName: databaseName },
  });

  return {
    uri: replicaSet.getUri(databaseName),
    stop: async () => {
      await replicaSet.stop();
    },
  };
}
