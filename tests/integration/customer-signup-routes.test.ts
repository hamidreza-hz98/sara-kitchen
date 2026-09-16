import { Mongoose } from "mongoose";
import type { Connection } from "mongoose";
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
vi.mock("@/server/environment", () => ({
  getServerEnvironment: () => ({
    AUTH_SESSION_SECRET: "test-signup-secret-at-least-32-characters-long",
  }),
}));

import { POST as signup } from "@/app/api/auth/customer/signup/route";
import { getSignupLimitModel } from "@/server/modules/auth/model/signup-limit";
import { getCustomerModel } from "@/server/modules/customers/model/customer";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

const URL = "http://localhost:3000/api/auth/customer/signup";
const base = {
  firstName: "  Sara ",
  lastName: "Kazemi",
  mobile: "912 345 678",
  email: "  SARA@EXAMPLE.COM ",
  password: "A long customer passphrase 2026",
  termsAccepted: true,
  marketingConsent: false,
};

function request(body: unknown, ip = "192.0.2.10", origin = "http://localhost:3000") {
  return new NextRequest(URL, {
    method: "POST",
    headers: { origin, "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

describe("customer signup Route Handler", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-customer-signup-test");
    client = new Mongoose();
    await client.connect(database.uri);
    databaseState.connection = client.connection;
    await getCustomerModel(client.connection).syncIndexes();
    await getSignupLimitModel(client.connection).syncIndexes();
  }, 120_000);

  afterAll(async () => {
    databaseState.connection = null;
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("creates a normalized customer with consent evidence but no verification or session", async () => {
    const response = await signup(request(base));
    expect(response.status).toBe(202);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.json()).toMatchObject({ ok: true, data: { accepted: true } });
    const customer = await getCustomerModel(databaseState.connection!)
      .findOne({ mobile: "+351912345678" })
      .select("+passwordHash");
    expect(customer).toMatchObject({
      firstName: "Sara",
      email: "sara@example.com",
      marketingConsent: false,
      mobileVerifiedAt: null,
      emailVerifiedAt: null,
    });
    expect(customer?.termsAcceptedAt).toBeInstanceOf(Date);
    expect(customer?.marketingConsentAt).toBeNull();
    expect(customer?.passwordHash).toMatch(/^\$argon2id\$/u);
    expect(JSON.stringify(customer)).not.toContain("passwordHash");
  });

  it("returns the same public result for existing mobile or email and does not overwrite either account", async () => {
    const duplicateMobile = await signup(request(base));
    const duplicateEmail = await signup(request({ ...base, mobile: "913456789" }));
    expect(duplicateMobile.status).toBe(202);
    expect(duplicateEmail.status).toBe(202);
    expect((await duplicateMobile.json()).data).toEqual((await duplicateEmail.json()).data);
    expect(await getCustomerModel(databaseState.connection!).countDocuments()).toBe(1);
  });

  it("accepts Unicode names, optional email, and explicit marketing opt-in", async () => {
    const response = await signup(
      request(
        {
          ...base,
          firstName: "سارا",
          lastName: "کاظمی",
          mobile: "914567890",
          email: "",
          marketingConsent: true,
        },
        "192.0.2.11",
      ),
    );
    expect(response.status).toBe(202);
    const customer = await getCustomerModel(databaseState.connection!).findOne({
      mobile: "+351914567890",
    });
    expect(customer?.email).toBeNull();
    expect(customer?.marketingConsentAt).toBeInstanceOf(Date);
  });

  it("rejects weak passwords, omitted terms, malformed identity and forged origins", async () => {
    const weak = await signup(
      request({ ...base, mobile: "915678901", password: "password123456" }, "192.0.2.12"),
    );
    expect(weak.status).toBe(400);
    expect(await weak.text()).not.toContain("password123456");
    expect(
      (await signup(request({ ...base, mobile: "915678902", termsAccepted: false }, "192.0.2.13")))
        .status,
    ).toBe(400);
    expect((await signup(request({ ...base, mobile: "not a number" }, "192.0.2.14"))).status).toBe(
      400,
    );
    expect((await signup(request(base, "192.0.2.15", "https://evil.example"))).status).toBe(403);
  });

  it("limits repeated identity attempts with a generic 429 and Retry-After", async () => {
    const payload = { ...base, mobile: "916789012", email: null };
    for (let index = 0; index < 5; index++) {
      const response = await signup(request({ ...payload, email: "" }, `192.0.2.${20 + index}`));
      expect(response.status).toBe(202);
    }
    const limited = await signup(request({ ...payload, email: "" }, "192.0.2.25"));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(
      await getCustomerModel(databaseState.connection!).countDocuments({ mobile: "+351916789012" }),
    ).toBe(1);
  });

  it("resolves concurrent signup attempts through unique indexes without leaking identity", async () => {
    const input = { ...base, mobile: "917890123", email: "parallel@example.com" };
    const results = await Promise.all([
      signup(request(input, "192.0.2.40")),
      signup(request(input, "192.0.2.41")),
    ]);
    expect(results.map((result) => result.status)).toEqual([202, 202]);
    expect(
      await getCustomerModel(databaseState.connection!).countDocuments({ mobile: "+351917890123" }),
    ).toBe(1);
  });
});
