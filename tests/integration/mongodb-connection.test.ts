import { Mongoose } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  createMongoConnectionCache,
  createMongoConnectionManager,
  MongoDatabaseConnectionError,
} from "@/server/database/connection-manager";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

describe("MongoDB connection manager", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-connection-manager-test");
    client = new Mongoose();
  }, 120_000);

  afterAll(async () => {
    if (client && client.connection.readyState !== 0) await client.disconnect();
    await database?.stop();
  });

  it("shares one in-flight connection across reload-like manager instances and reconnects", async () => {
    const cache = createMongoConnectionCache();
    const testClient = client;
    const testDatabase = database;
    if (!testClient || !testDatabase) throw new Error("Test MongoDB did not start.");
    const connectSpy = vi.spyOn(testClient, "connect");
    const managerAfterFirstLoad = createMongoConnectionManager({
      cache,
      getUri: () => testDatabase.uri,
      mongooseClient: testClient,
    });
    const managerAfterReload = createMongoConnectionManager({
      cache,
      getUri: () => testDatabase.uri,
      mongooseClient: testClient,
    });

    const [first, second, third] = await Promise.all([
      managerAfterFirstLoad.connect(),
      managerAfterReload.connect(),
      managerAfterFirstLoad.connect(),
    ]);

    expect(first).toBe(second);
    expect(second).toBe(third);
    expect(connectSpy).toHaveBeenCalledTimes(1);
    await expect(first.db?.admin().ping()).resolves.toMatchObject({ ok: 1 });

    await managerAfterFirstLoad.disconnect();
    expect(testClient.connection.readyState).toBe(0);

    const reconnected = await managerAfterReload.connect();
    expect(connectSpy).toHaveBeenCalledTimes(2);
    expect(reconnected.readyState).toBe(1);
    await expect(reconnected.db?.admin().ping()).resolves.toMatchObject({ ok: 1 });

    await managerAfterReload.disconnect();
    connectSpy.mockRestore();
  });

  it("clears rejected attempts and never exposes credentials in its public error", async () => {
    const isolatedClient = new Mongoose();
    const cache = createMongoConnectionCache();
    const secretUri =
      "mongodb://private-user:private-password@127.0.0.1:1/private-db?authSource=admin";
    const manager = createMongoConnectionManager({
      cache,
      connectOptions: { connectTimeoutMS: 200, serverSelectionTimeoutMS: 200 },
      getUri: () => secretUri,
      mongooseClient: isolatedClient,
    });

    let connectionError: unknown;
    try {
      await manager.connect();
    } catch (error) {
      connectionError = error;
    }

    expect(connectionError).toBeInstanceOf(MongoDatabaseConnectionError);
    const exposedError = JSON.stringify(connectionError) + String(connectionError);
    expect(exposedError).not.toContain(secretUri);
    expect(exposedError).not.toContain("private-user");
    expect(exposedError).not.toContain("private-password");
    expect(cache).toMatchObject({ connection: null, promise: null, uriFingerprint: null });

    await expect(manager.connect()).rejects.toBeInstanceOf(MongoDatabaseConnectionError);
    expect(cache).toMatchObject({ connection: null, promise: null, uriFingerprint: null });

    await manager.disconnect();
  });
});
