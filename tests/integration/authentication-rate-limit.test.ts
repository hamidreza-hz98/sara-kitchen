import { Mongoose } from "mongoose";
import type { Connection } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/environment", () => ({
  getServerEnvironment: () => ({
    AUTH_SESSION_SECRET: "test-session-secret-with-at-least-32-characters",
  }),
}));

import { ApiError } from "@/server/http";
import { getAuthenticationLimitModel } from "@/server/modules/auth/model/authentication-limit";
import {
  limitPasswordResetToken,
  limitSensitiveAccountOperation,
  limitVerificationAttempt,
} from "@/server/modules/auth/service/authentication-limit";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

function request(ip: string) {
  return new Request("http://localhost:3000/api/auth/test", {
    headers: { "x-forwarded-for": ip },
  });
}

describe("authentication rate-limit buckets", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;
  let connection: Connection;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-authentication-limit-test");
    client = new Mongoose();
    await client.connect(database.uri);
    connection = client.connection;
    await getAuthenticationLimitModel(connection).syncIndexes();
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("limits verification independently by normalized identity with generic retry metadata", async () => {
    for (let index = 0; index < 6; index++) {
      await limitVerificationAttempt(
        connection,
        request(`192.0.2.${index + 1}`),
        "USER@Example.com",
      );
    }
    let rejected: unknown;
    try {
      await limitVerificationAttempt(connection, request("192.0.2.20"), " user@example.COM ");
    } catch (error) {
      rejected = error;
    }
    expect(rejected).toBeInstanceOf(ApiError);
    expect(rejected).toMatchObject({
      type: "rateLimit",
      details: { retryAfterSeconds: expect.any(Number) },
    });
    const serialized = JSON.stringify(
      await getAuthenticationLimitModel(connection).find().select("+keyHash").lean().exec(),
    );
    expect(serialized).not.toContain("user@example.com");
    expect(serialized).not.toContain("192.0.2.");
  });

  it("limits a sensitive operation by actor even when source IP changes", async () => {
    for (let index = 0; index < 5; index++) {
      await limitSensitiveAccountOperation(connection, request(`198.51.100.${index + 1}`), {
        principal: "customer",
        actorId: "507f1f77bcf86cd799439011",
        operation: "change-password",
      });
    }
    await expect(
      limitSensitiveAccountOperation(connection, request("198.51.100.20"), {
        principal: "customer",
        actorId: "507f1f77bcf86cd799439011",
        operation: "change-password",
      }),
    ).rejects.toMatchObject({ type: "rateLimit" });
  });

  it("limits repeated reset-token guesses without storing the bearer", async () => {
    const token = "reset-bearer-that-must-never-be-persisted";
    for (let index = 0; index < 8; index++) await limitPasswordResetToken(connection, token);
    await expect(limitPasswordResetToken(connection, token)).rejects.toMatchObject({
      type: "rateLimit",
    });
    const serialized = JSON.stringify(
      await getAuthenticationLimitModel(connection).find().select("+keyHash").lean().exec(),
    );
    expect(serialized).not.toContain(token);
  });
});
