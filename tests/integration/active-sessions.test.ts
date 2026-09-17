import { Mongoose } from "mongoose";
import type { Connection } from "mongoose";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  connection: null as Connection | null,
  cookieName: "",
  cookieToken: "" as string | undefined,
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === state.cookieName && state.cookieToken ? { value: state.cookieToken } : undefined,
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/server/database", () => ({
  connectToDatabase: async () => {
    if (!state.connection) throw new Error("Test database is not ready.");
    return state.connection;
  },
}));
vi.mock("@/server/environment", () => ({
  getServerEnvironment: () => ({
    AUTH_SESSION_SECRET: "test-session-secret-with-at-least-32-characters",
  }),
}));

import { GET as adminGet, POST as adminPost } from "@/app/api/auth/admin/sessions/route";
import { GET as customerGet, POST as customerPost } from "@/app/api/auth/customer/sessions/route";
import { revokeOtherSessionsAction } from "@/app/actions/revoke-other-sessions";
import DashboardDeepLinkPage from "@/app/[locale]/(dashboard)/dashboard/[...rest]/page";
import { requireDashboardPage } from "@/server/auth/page-guards";
import { requireCustomerPage } from "@/server/auth/page-guards";
import { getAdminModel } from "@/server/modules/admins/model/admin";
import { hashAdminPassword } from "@/server/modules/admins/service/password";
import { resolveAdminActor } from "@/server/modules/auth/service/admin-session";
import { resolveCustomerActor } from "@/server/modules/auth/service/customer-session";
import {
  AuthorizationGuardError,
  requireAdminActor,
  requireCustomerActor,
  requireCustomerOwnership,
} from "@/server/modules/auth/policy/guards";
import { getCustomerModel } from "@/server/modules/customers/model/customer";
import { hashCustomerPassword } from "@/server/modules/customers/service/password";
import { issueSession } from "@/server/modules/sessions/service/issue-session";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

const baseUrl = "http://localhost:3000/api/auth";

function request(
  principal: "admin" | "customer",
  token: string | undefined,
  body?: unknown,
  origin = "http://localhost:3000",
) {
  return new NextRequest(`${baseUrl}/${principal}/sessions`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body === undefined ? {} : { origin, "content-type": "application/json" }),
      ...(token
        ? { cookie: `${principal === "admin" ? "sara_admin_dev" : "sara_customer_dev"}=${token}` }
        : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("owner-scoped active session management", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;
  let admin: {
    current: Awaited<ReturnType<typeof issueSession>>;
    other: Awaited<ReturnType<typeof issueSession>>;
  };
  let foreignAdmin: Awaited<ReturnType<typeof issueSession>>;
  let viewerAdmin: Awaited<ReturnType<typeof issueSession>>;
  let customer: {
    current: Awaited<ReturnType<typeof issueSession>>;
    other: Awaited<ReturnType<typeof issueSession>>;
  };

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-active-sessions-test");
    client = new Mongoose();
    await client.connect(database.uri);
    state.connection = client.connection;
    const Admin = getAdminModel(client.connection);
    const owner = await Admin.create({
      firstName: "Sara",
      lastName: "Kazemi",
      identifier: "sara@example.com",
      role: "owner",
      passwordHash: await hashAdminPassword("A strong administrator passphrase 2026"),
    });
    const secondAdmin = await Admin.create({
      firstName: "Other",
      lastName: "Manager",
      identifier: "other@example.com",
      role: "manager",
      passwordHash: await hashAdminPassword("Another strong administrator passphrase"),
    });
    const viewer = await Admin.create({
      firstName: "Read",
      lastName: "Only",
      identifier: "viewer@example.com",
      role: "viewer",
      passwordHash: await hashAdminPassword("A read only administrator passphrase"),
    });
    const customerRecord = await getCustomerModel(client.connection).create({
      firstName: "Customer",
      lastName: "One",
      mobile: "+351912345678",
      passwordHash: await hashCustomerPassword("A strong customer passphrase 2026"),
    });
    const expiry = new Date(Date.now() + 60 * 60_000);
    admin = {
      current: await issueSession(client.connection, {
        actorKind: "admin",
        actorId: owner._id,
        expiresAt: expiry,
        ipAddress: "192.0.2.10",
        userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/125.0 Safari/537.36",
      }),
      other: await issueSession(client.connection, {
        actorKind: "admin",
        actorId: owner._id,
        expiresAt: expiry,
        userAgent: "Mozilla/5.0 (iPhone) Safari/605.1",
      }),
    };
    foreignAdmin = await issueSession(client.connection, {
      actorKind: "admin",
      actorId: secondAdmin._id,
      expiresAt: expiry,
    });
    viewerAdmin = await issueSession(client.connection, {
      actorKind: "admin",
      actorId: viewer._id,
      expiresAt: expiry,
    });
    customer = {
      current: await issueSession(client.connection, {
        actorKind: "customer",
        actorId: customerRecord._id,
        expiresAt: expiry,
      }),
      other: await issueSession(client.connection, {
        actorKind: "customer",
        actorId: customerRecord._id,
        expiresAt: expiry,
      }),
    };
  }, 120_000);

  afterAll(async () => {
    state.connection = null;
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("lists only the actor's active sessions with coarse device data and no secrets", async () => {
    const response = await adminGet(request("admin", admin.current.token));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body.data.total).toBe(2);
    expect(body.data.sessions).toHaveLength(2);
    expect(body.data.sessions.find((item: { current: boolean }) => item.current)).toMatchObject({
      id: admin.current.id,
      browser: "chrome",
      platform: "windows",
    });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(admin.current.token);
    expect(serialized).not.toContain("192.0.2.10");
    expect(serialized).not.toContain("Mozilla/5.0");
    expect(serialized).not.toContain(foreignAdmin.id);
    expect((await adminGet(request("admin", customer.current.token))).status).toBe(401);
    expect((await customerGet(request("customer", admin.current.token))).status).toBe(401);
  });

  it("rejects foreign targets and foreign origins without revoking another actor", async () => {
    expect(
      (
        await adminPost(
          request("admin", admin.current.token, { action: "one", sessionId: foreignAdmin.id }),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await adminPost(
          request("admin", admin.current.token, { action: "one", sessionId: admin.current.id }),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await adminPost(
          request("admin", admin.current.token, { action: "others" }, "https://evil.example"),
        )
      ).status,
    ).toBe(403);
    expect(await resolveAdminActor(state.connection!, foreignAdmin.token)).not.toBeNull();
    expect(await resolveAdminActor(state.connection!, admin.current.token)).not.toBeNull();
  });

  it("resolves each actor server-side and enforces permissions and object ownership", async () => {
    const connection = state.connection!;
    const owner = await requireAdminActor(connection, admin.current.token, "admins:delete");
    const customerActor = await requireCustomerActor(connection, customer.current.token);
    expect(owner.role).toBe("owner");
    expect(() => requireCustomerOwnership(customerActor, customerActor.id)).not.toThrow();
    expect(() => requireCustomerOwnership(customerActor, owner.id)).toThrowError(
      AuthorizationGuardError,
    );
    await expect(
      requireAdminActor(connection, viewerAdmin.token, "orders:read"),
    ).rejects.toMatchObject({
      reason: "forbidden",
    });
    await expect(requireAdminActor(connection, customer.current.token)).rejects.toMatchObject({
      reason: "unauthenticated",
    });
    await expect(requireCustomerActor(connection, admin.current.token)).rejects.toMatchObject({
      reason: "unauthenticated",
    });
  });

  it("denies direct dashboard URLs independently of hidden navigation", async () => {
    state.cookieName = "sara_admin_dev";
    state.cookieToken = viewerAdmin.token;
    await expect(requireDashboardPage(["orders"])).rejects.toThrow("NOT_FOUND");
    await expect(
      DashboardDeepLinkPage({ params: Promise.resolve({ rest: ["orders"] }) }),
    ).rejects.toThrow("NOT_FOUND");
    await expect(requireDashboardPage(["unknown"])).rejects.toThrow("NOT_FOUND");
    state.cookieToken = undefined;
    await expect(requireDashboardPage(["orders"])).rejects.toThrow("REDIRECT:/authentication");
  });

  it("protects profile pages with customer sessions, not admin cookies", async () => {
    state.cookieName = "sara_customer_dev";
    state.cookieToken = admin.current.token;
    await expect(requireCustomerPage()).rejects.toThrow("REDIRECT:/login");
    state.cookieToken = customer.current.token;
    expect((await requireCustomerPage()).id).toMatch(/^[a-f\d]{24}$/u);
  });

  it("rechecks the actor inside a Server Action instead of trusting its calling page", async () => {
    state.cookieName = "sara_admin_dev";
    state.cookieToken = customer.current.token;
    await expect(revokeOtherSessionsAction("admin")).rejects.toMatchObject({
      reason: "unauthenticated",
    });
    state.cookieName = "sara_customer_dev";
    state.cookieToken = customer.current.token;
    expect(await revokeOtherSessionsAction("customer")).toBe(1);
    expect(await resolveCustomerActor(state.connection!, customer.other.token)).toBeNull();
  });

  it("revokes an individual admin session before its next protected request", async () => {
    const response = await adminPost(
      request("admin", admin.current.token, { action: "one", sessionId: admin.other.id }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ revoked: 1 });
    expect(await resolveAdminActor(state.connection!, admin.other.token)).toBeNull();
    expect(await resolveAdminActor(state.connection!, admin.current.token)).not.toBeNull();
  });

  it("revokes all other customer sessions while preserving the current session", async () => {
    const response = await customerPost(
      request("customer", customer.current.token, { action: "others" }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ revoked: 0 });
    expect(await resolveCustomerActor(state.connection!, customer.other.token)).toBeNull();
    expect(await resolveCustomerActor(state.connection!, customer.current.token)).not.toBeNull();
    const refreshed = await customerGet(request("customer", customer.current.token));
    expect((await refreshed.json()).data.total).toBe(1);
  });
});
