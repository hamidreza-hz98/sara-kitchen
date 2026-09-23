import { Mongoose } from "mongoose";
import type { Connection } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/environment", () => ({
  getServerEnvironment: () => ({
    AUTH_SESSION_SECRET: "test-session-secret-with-at-least-32-characters",
  }),
}));

import { consumeRequestRateLimit } from "@/server/http/request-rate-limit";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

function request(address: string) {
  return new Request("http://localhost:3000/api/dishes", {
    headers: { "x-forwarded-for": address },
  });
}

describe("request rate limiter", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;
  let connection: Connection;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-request-rate-limit-test");
    client = new Mongoose();
    await client.connect(database.uri);
    connection = client.connection;
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("rejects excess requests with retry metadata while isolating source buckets", async () => {
    const policy = { scope: "dish-contract-test", limit: 2, windowMs: 60_000 } as const;
    await consumeRequestRateLimit(connection, request("192.0.2.1"), policy);
    await consumeRequestRateLimit(connection, request("192.0.2.1"), policy);
    await expect(
      consumeRequestRateLimit(connection, request("192.0.2.1"), policy),
    ).rejects.toMatchObject({
      type: "rateLimit",
      details: { retryAfterSeconds: expect.any(Number) },
    });
    await expect(
      consumeRequestRateLimit(connection, request("192.0.2.2"), policy),
    ).resolves.toBeUndefined();
    const persisted = JSON.stringify(
      await connection.collection("request_rate_limits").find().toArray(),
    );
    expect(persisted).not.toContain("192.0.2.");
  });
});
