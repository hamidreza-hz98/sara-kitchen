import { Mongoose } from "mongoose";
import type { Connection, Types } from "mongoose";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const databaseState = vi.hoisted(() => ({ connection: null as Connection | null }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/database", () => ({
  connectToDatabase: async () => {
    if (!databaseState.connection) throw new Error("Test connection not ready.");
    return databaseState.connection;
  },
}));

import { POST as login } from "@/app/api/auth/customer/login/route";
import { POST as logout } from "@/app/api/auth/customer/logout/route";
import { GET as sessionStatus } from "@/app/api/auth/customer/session/route";
import { getCustomerModel } from "@/server/modules/customers/model/customer";
import { hashCustomerPassword } from "@/server/modules/customers/service/password";
import { getSessionModel } from "@/server/modules/sessions/model/session";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

const URL = "http://localhost:3000/api/auth/customer";
const password = "A strong customer passphrase 2026";

function request(path: string, body: unknown, cookie?: string, origin = "http://localhost:3000") {
  return new NextRequest(`${URL}/${path}`, {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      ...(cookie ? { cookie: `sara_customer_dev=${cookie}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function getRequest(cookie?: string) {
  return new NextRequest(`${URL}/session`, {
    headers: cookie ? { cookie: `sara_customer_dev=${cookie}` } : {},
  });
}

function tokenFromCookie(response: Response) {
  return response.headers.get("set-cookie")?.match(/sara_customer_dev=([^;]+)/u)?.[1];
}

describe("customer authentication Route Handlers", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;
  let customerId: Types.ObjectId;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-customer-auth-routes-test");
    client = new Mongoose();
    await client.connect(database.uri);
    databaseState.connection = client.connection;
    const customer = await getCustomerModel(client.connection).create({
      firstName: "Sara",
      lastName: "Kazemi",
      mobile: "912345678",
      email: "sara@example.com",
      passwordHash: await hashCustomerPassword(password),
    });
    customerId = customer._id;
  }, 120_000);

  afterAll(async () => {
    databaseState.connection = null;
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("authenticates by normalized mobile or email and returns only public identity", async () => {
    for (const identifier of [" 912 345 678 ", " SARA@EXAMPLE.COM "]) {
      const response = await login(request("login", { identifier, password, persistent: false }));
      expect(response.status).toBe(200);
      const token = tokenFromCookie(response);
      expect(token).toHaveLength(43);
      const setCookie = response.headers.get("set-cookie") ?? "";
      expect(setCookie).toContain("HttpOnly");
      expect(setCookie).toContain("SameSite=Strict");
      expect(setCookie).not.toContain("Max-Age=");
      expect(setCookie).not.toContain("Domain=");
      expect(await response.json()).toMatchObject({
        data: { authenticated: true, displayName: "Sara Kazemi" },
      });
      const status = await sessionStatus(getRequest(token));
      expect(await status.json()).toMatchObject({
        data: { authenticated: true, displayName: "Sara Kazemi" },
      });
      expect(status.headers.get("cache-control")).toBe("no-store");
      const stored = await getSessionModel(databaseState.connection!).collection.findOne(
        { actorId: customerId, tokenHash: { $exists: true } },
        { sort: { createdAt: -1 } },
      );
      expect(stored?.audience).toBe("customer");
      expect(stored?.tokenHash).not.toBe(token);
      expect(stored?.persistent).toBe(false);
    }
  });

  it("uses an explicit persistent cookie and server-enforced persistent idle policy", async () => {
    const response = await login(
      request("login", { identifier: "sara@example.com", password, persistent: true }),
    );
    const token = tokenFromCookie(response);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=");
    const record = await getSessionModel(databaseState.connection!).collection.findOne({
      tokenHash: { $exists: true },
      persistent: true,
    });
    if (!record) throw new Error("Persistent session was not stored.");
    expect(record?.persistent).toBe(true);
    expect(record?.expiresAt.getTime() - Date.now()).toBeGreaterThan(29 * 24 * 60 * 60 * 1_000);
    expect((await sessionStatus(getRequest(token))).status).toBe(200);
    await getSessionModel(databaseState.connection!).collection.updateOne(
      { _id: record._id },
      { $set: { lastSeenAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1_000) } },
    );
    expect(await (await sessionStatus(getRequest(token))).json()).toMatchObject({
      data: { authenticated: false },
    });
  });

  it("returns the same public rejection for wrong, unknown, and disabled identities", async () => {
    const bad = await login(
      request("login", { identifier: "sara@example.com", password: "wrong" }),
    );
    const unknown = await login(
      request("login", { identifier: "missing@example.com", password: "wrong" }),
    );
    await getCustomerModel(databaseState.connection!).updateOne(
      { _id: customerId },
      { $set: { status: "disabled" } },
    );
    const disabled = await login(request("login", { identifier: "sara@example.com", password }));
    const bodies = await Promise.all(
      [bad, unknown, disabled].map(async (response) => {
        expect(response.status).toBe(401);
        expect(response.headers.get("set-cookie")).toBeNull();
        return (await response.json()).error;
      }),
    );
    expect(bodies.map(({ code, message }) => ({ code, message }))).toEqual(
      Array(3).fill({ code: "AUTHENTICATION_REQUIRED", message: "Invalid credentials." }),
    );
    await getCustomerModel(databaseState.connection!).updateOne(
      { _id: customerId },
      { $set: { status: "active" } },
    );
  });

  it("rotates a prior customer token, then revokes and clears it on logout", async () => {
    const first = await login(request("login", { identifier: "sara@example.com", password }));
    const oldToken = tokenFromCookie(first);
    const second = await login(
      request("login", { identifier: "sara@example.com", password }, oldToken),
    );
    const newToken = tokenFromCookie(second);
    expect(newToken).not.toBe(oldToken);
    expect(await (await sessionStatus(getRequest(oldToken))).json()).toMatchObject({
      data: { authenticated: false },
    });
    expect(await (await sessionStatus(getRequest(newToken))).json()).toMatchObject({
      data: { authenticated: true },
    });
    const signedOut = await logout(request("logout", {}, newToken));
    expect(signedOut.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(await (await sessionStatus(getRequest(newToken))).json()).toMatchObject({
      data: { authenticated: false },
    });
    expect((await logout(request("logout", {}, newToken))).status).toBe(200);
  });

  it("rejects cross-origin mutation and denies stale password-version sessions", async () => {
    expect(
      (
        await login(
          request(
            "login",
            { identifier: "sara@example.com", password },
            undefined,
            "https://evil.example",
          ),
        )
      ).status,
    ).toBe(403);
    const response = await login(request("login", { identifier: "sara@example.com", password }));
    const token = tokenFromCookie(response);
    await getCustomerModel(databaseState.connection!).updateOne(
      { _id: customerId },
      { $inc: { passwordVersion: 1 } },
    );
    expect(await (await sessionStatus(getRequest(token))).json()).toMatchObject({
      data: { authenticated: false },
    });
  });
});
