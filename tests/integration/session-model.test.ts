import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getSessionModel } from "@/server/modules/sessions/model/session";
import { issueSession } from "@/server/modules/sessions/service/issue-session";
import { hashSessionToken } from "@/server/modules/sessions/service/session-token";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

describe("persisted sessions", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-session-model-test");
    client = new Mongoose();
    await client.connect(database.uri);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("persists only a token hash with actor, expiry and safe metadata", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const Session = getSessionModel(client.connection);
    await Session.syncIndexes();
    const actorId = new Types.ObjectId();
    const expiresAt = new Date(Date.now() + 3_600_000);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    let issued;
    try {
      issued = await issueSession(client.connection, {
        actorKind: "customer",
        actorId,
        expiresAt,
        ipAddress: "127.0.0.1",
        userAgent: "Sara Kitchen browser",
      });
    } finally {
      expect(log).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
      log.mockRestore();
      warn.mockRestore();
    }
    expect(issued?.token).toHaveLength(43);
    expect(JSON.stringify(issued)).not.toContain(issued?.token);
    expect(Object.keys(issued ?? {})).not.toContain("token");
    const stored = await Session.collection.findOne({ _id: new Types.ObjectId(issued?.id) });
    expect(stored).not.toBeNull();
    expect(stored?.tokenHash).toBe(hashSessionToken(issued?.token ?? ""));
    expect(stored?.tokenHash).not.toBe(issued?.token);
    expect(JSON.stringify(stored)).not.toContain(issued?.token);
    expect(stored?.token).toBeUndefined();
    expect(stored?.actorKind).toBe("customer");
    expect(stored?.audience).toBe("customer");
    expect(stored?.actorId.toHexString()).toBe(actorId.toHexString());
    expect(stored?.lastSeenAt).toBeInstanceOf(Date);
    expect(stored?.expiresAt).toEqual(expiresAt);
    expect(stored?.ipAddress).toBe("127.0.0.1");
    expect(stored?.userAgent).toBe("Sara Kitchen browser");
    expect(stored?.revokedAt).toBeNull();

    const ordinary = await Session.findById(issued?.id);
    expect(ordinary?.tokenHash).toBeUndefined();
    expect(ordinary?.ipAddress).toBeUndefined();
    expect(ordinary?.toJSON()).not.toHaveProperty("tokenHash");
    expect(await Session.collection.indexes()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: { tokenHash: 1 }, unique: true }),
        expect.objectContaining({ key: { expiresAt: 1 }, expireAfterSeconds: 0 }),
      ]),
    );
  });

  it("rejects invalid issuance before writing a session", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const Session = getSessionModel(client.connection);
    const before = await Session.countDocuments();
    await expect(
      issueSession(client.connection, {
        actorKind: "admin",
        actorId: new Types.ObjectId(),
        expiresAt: new Date(Date.now() - 1_000),
      }),
    ).rejects.toThrow(RangeError);
    expect(await Session.countDocuments()).toBe(before);
  });
});
