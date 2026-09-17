import { Mongoose } from "mongoose";
import type { Connection } from "mongoose";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const databaseState = vi.hoisted(() => ({ connection: null as Connection | null }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/environment", () => ({
  getServerEnvironment: () => ({
    AUTH_SESSION_SECRET: "test-session-secret-with-at-least-32-characters",
  }),
}));
vi.mock("@/server/database", () => ({
  connectToDatabase: async () => {
    if (!databaseState.connection) throw new Error("Test connection not ready.");
    return databaseState.connection;
  },
}));

import { POST as login } from "@/app/api/auth/admin/login/route";
import { POST as logout } from "@/app/api/auth/admin/logout/route";
import { getAdminModel } from "@/server/modules/admins/model/admin";
import { hashAdminPassword } from "@/server/modules/admins/service/password";
import { createCsrfToken } from "@/server/modules/auth/policy/csrf";
import { resolveAdminActor } from "@/server/modules/auth/service/admin-session";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

const URL = "http://localhost:3000/api/auth/admin";
const password = "A strong administrator passphrase 2026";

function request(path: string, body: unknown, cookie?: string, origin = "http://localhost:3000") {
  return new NextRequest(`${URL}/${path}`, {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      ...(path === "logout" && cookie ? { "x-csrf-token": createCsrfToken("admin", cookie) } : {}),
      ...(cookie ? { cookie: `sara_admin_dev=${cookie}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function tokenFromCookie(response: Response): string | undefined {
  return response.headers.get("set-cookie")?.match(/sara_admin_dev=([^;]+)/u)?.[1];
}

describe("admin authentication Route Handlers", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-auth-routes-test");
    client = new Mongoose();
    await client.connect(database.uri);
    databaseState.connection = client.connection;
    await getAdminModel(client.connection).create({
      firstName: "Sara",
      lastName: "Kazemi",
      identifier: "sara",
      role: "owner",
      passwordHash: await hashAdminPassword(password),
    });
  }, 120_000);

  afterAll(async () => {
    databaseState.connection = null;
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("sets a private same-site cookie without returning the token in JSON", async () => {
    const response = await login(request("login", { identifier: "SARA", password }));
    expect(response.status).toBe(200);
    const token = tokenFromCookie(response);
    expect(token).toHaveLength(43);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=Strict");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).not.toContain(token);
    expect((await resolveAdminActor(databaseState.connection!, token))?.displayName).toBe(
      "Sara Kazemi",
    );
  });

  it("returns a generic error without a cookie for invalid credentials or origin", async () => {
    const wrong = await login(request("login", { identifier: "sara", password: "wrong" }));
    expect(wrong.status).toBe(401);
    expect(wrong.headers.get("set-cookie")).toBeNull();
    expect(await wrong.text()).not.toContain("sara");
    const forged = await login(
      request("login", { identifier: "sara", password }, undefined, "https://evil.example"),
    );
    expect(forged.status).toBe(403);
    expect(forged.headers.get("set-cookie")).toBeNull();
  });

  it("clears and revokes the cookie on logout", async () => {
    const loggedIn = await login(request("login", { identifier: "sara", password }));
    const token = tokenFromCookie(loggedIn);
    expect(token).toBeDefined();
    const response = await logout(request("logout", {}, token));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(await resolveAdminActor(databaseState.connection!, token)).toBeNull();
  });
});
