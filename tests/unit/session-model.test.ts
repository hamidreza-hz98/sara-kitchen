import { Mongoose, Types } from "mongoose";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getSessionModel } from "@/server/modules/sessions/model/session";
import {
  generateSessionToken,
  hashSessionToken,
} from "@/server/modules/sessions/service/session-token";

describe("session model and bearer token", () => {
  const client = new Mongoose();
  const Session = getSessionModel(client.connection);

  function validSession() {
    return new Session({
      tokenHash: hashSessionToken(generateSessionToken()),
      actorKind: "admin",
      actorId: new Types.ObjectId(),
      audience: "admin",
      expiresAt: new Date(Date.now() + 60_000),
      ipAddress: "2001:db8::1",
      userAgent: "Sara Kitchen test browser",
    });
  }

  it("generates unique 256-bit opaque tokens and stable SHA-256 digests", () => {
    const first = generateSessionToken();
    const second = generateSessionToken();
    expect(first).toHaveLength(43);
    expect(second).not.toBe(first);
    expect(Buffer.from(first, "base64url")).toHaveLength(32);
    expect(hashSessionToken(first)).toMatch(/^[a-f0-9]{64}$/u);
    expect(hashSessionToken(first)).toBe(hashSessionToken(first));
    expect(hashSessionToken(first)).not.toBe(hashSessionToken(second));
    expect(() => hashSessionToken("bad-token")).toThrow(TypeError);
  });

  it("uses shared timestamps, validates actor/audience and revocation invariants", async () => {
    const session = validSession();
    await expect(session.validate()).resolves.toBeUndefined();
    expect(session.schemaVersion).toBe(1);
    expect(session.lastSeenAt).toBeInstanceOf(Date);
    expect(session.revokedAt).toBeNull();
    expect(session.revocationReason).toBeNull();
    expect(Session.schema.options.timestamps).toBe(true);
    expect(getSessionModel(client.connection)).toBe(Session);

    session.audience = "customer";
    session.revocationReason = "logout";
    const error = (await session.validate().catch((cause: unknown) => cause)) as Error & {
      errors?: Record<string, unknown>;
    };
    expect(Object.keys(error.errors ?? {})).toEqual(
      expect.arrayContaining(["audience", "revocationReason"]),
    );
    session.audience = "admin";
    session.revokedAt = new Date();
    await expect(session.validate()).resolves.toBeUndefined();
  });

  it("rejects plaintext tokens, invalid metadata, and last-seen after expiry", async () => {
    const session = validSession();
    session.tokenHash = generateSessionToken();
    session.ipAddress = "not-an-ip";
    session.userAgent = "injected\nagent";
    session.lastSeenAt = new Date(Date.now() + 120_000);
    const error = (await session.validate().catch((cause: unknown) => cause)) as Error & {
      errors?: Record<string, unknown>;
    };
    expect(Object.keys(error.errors ?? {})).toEqual(
      expect.arrayContaining(["tokenHash", "ipAddress", "userAgent", "lastSeenAt"]),
    );
  });

  it("hides token digest and IP from ordinary queries and JSON", async () => {
    const session = validSession();
    await session.validate();
    const json = session.toJSON() as Record<string, unknown>;
    expect(json.tokenHash).toBeUndefined();
    expect(json.ipAddress).toBeUndefined();
    expect(json.actorId).toBe(session.actorId.toHexString());
    expect(Session.schema.path("tokenHash").options.select).toBe(false);
    expect(Session.schema.path("ipAddress").options.select).toBe(false);
    expect(Session.schema.path("token")).toBeUndefined();
  });

  it("indexes token uniqueness, active sessions and expiry cleanup", () => {
    expect(Session.schema.indexes()).toEqual(
      expect.arrayContaining([
        [{ tokenHash: 1 }, expect.objectContaining({ unique: true })],
        [{ actorKind: 1, actorId: 1, revokedAt: 1, expiresAt: 1 }, expect.any(Object)],
        [{ expiresAt: 1 }, expect.objectContaining({ expireAfterSeconds: 0 })],
      ]),
    );
  });
});
