import { Mongoose, Schema } from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ApiError } from "@/server/http/api-error";
import { runIdempotentOperation } from "@/server/modules/transactions";

import { startTestMongoReplicaSet, type TestMongoDatabase } from "../helpers/mongodb";

describe("durable idempotency", () => {
  let database: TestMongoDatabase;
  let client: Mongoose;

  beforeAll(async () => {
    database = await startTestMongoReplicaSet("sara-kitchen-idempotency-test");
    client = new Mongoose();
    await client.connect(database.uri);
    // Production provisioning must create these indexes before traffic.
    await client.connection
      .collection("idempotency_records")
      .createIndex({ scope: 1, subject: 1, key: 1 }, { unique: true });
    await client.connection
      .collection("idempotency_records")
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  }, 120_000);

  afterAll(async () => {
    await client?.disconnect();
    await database?.stop();
  });

  it("replays identical checkout results, rejects conflicting reuse, and scopes keys", async () => {
    const Order = client.model("IdempotencyOrder", new Schema({ code: String }));
    let executions = 0;
    const checkout = (subject: string, request: { dish: string }) =>
      runIdempotentOperation({
        connection: client.connection,
        scope: "checkout",
        subject,
        key: "checkout-abc123",
        request,
        retentionMs: 86_400_000,
        messages: { conflict: "Localized conflict", processing: "Localized processing" },
        execute: async (session) => {
          executions += 1;
          const code = subject === "customer-1" ? "SK-ONE" : "SK-TWO";
          await Order.create([{ code }], { session });
          return { code };
        },
      });

    expect(await checkout("customer-1", { dish: "soup" })).toEqual({
      result: { code: "SK-ONE" },
      replayed: false,
    });
    const attemptsAfterFirst = executions;
    expect(await checkout("customer-1", { dish: "soup" })).toEqual({
      result: { code: "SK-ONE" },
      replayed: true,
    });
    expect(executions).toBe(attemptsAfterFirst);
    expect(await Order.countDocuments()).toBe(1);
    await expect(checkout("customer-1", { dish: "rice" })).rejects.toMatchObject({
      status: 409,
      publicMessage: "Localized conflict",
      details: { field: "idempotencyKey" },
    } satisfies Partial<ApiError>);
    expect(await Order.countDocuments()).toBe(1);
    expect(await checkout("customer-2", { dish: "rice" })).toMatchObject({ replayed: false });
    expect(await Order.countDocuments()).toBe(2);
    const record = await client.connection
      .collection("idempotency_records")
      .findOne({ scope: "checkout", subject: "customer-1" });
    expect(record).toMatchObject({ status: "completed", result: '{"code":"SK-ONE"}' });
    expect(record?.fingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(record?.expiresAt).toBeInstanceOf(Date);
    const indexes = await client.connection.collection("idempotency_records").indexes();
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: { scope: 1, subject: 1, key: 1 }, unique: true }),
        expect.objectContaining({ key: { expiresAt: 1 }, expireAfterSeconds: 0 }),
      ]),
    );
  });

  it("rolls back the key when payment work fails, then permits a successful retry", async () => {
    const Payment = client.model("IdempotencyPayment", new Schema({ reference: String }));
    const base = {
      connection: client.connection,
      scope: "payment" as const,
      subject: "customer-1",
      key: "payment-abc123",
      request: { order: "SK-1" },
      retentionMs: 86_400_000,
    };
    await expect(
      runIdempotentOperation({
        ...base,
        execute: async (session) => {
          await Payment.create([{ reference: "MB-1" }], { session });
          throw new Error("injected failure");
        },
      }),
    ).rejects.toThrow("injected failure");
    expect(await Payment.countDocuments()).toBe(0);
    expect(
      await client.connection.collection("idempotency_records").countDocuments({ key: base.key }),
    ).toBe(0);

    expect(
      await runIdempotentOperation({
        ...base,
        execute: async (session) => {
          await Payment.create([{ reference: "MB-1" }], { session });
          return { reference: "MB-1" };
        },
      }),
    ).toEqual({ result: { reference: "MB-1" }, replayed: false });
    expect(await Payment.countDocuments()).toBe(1);
  });

  it("permits one concurrent webhook effect and replays the other caller", async () => {
    const Event = client.model("IdempotencyEvent", new Schema({ reference: String }));
    let executions = 0;
    const webhook = () =>
      runIdempotentOperation({
        connection: client.connection,
        scope: "webhook",
        subject: "mbway-sandbox",
        key: "provider-event-123",
        request: { event: "paid", reference: "MB-1" },
        retentionMs: 86_400_000,
        execute: async (session) => {
          executions += 1;
          await Event.create([{ reference: "MB-1" }], { session });
          return { acknowledged: true };
        },
      });
    const outcomes = await Promise.all([webhook(), webhook()]);
    expect(outcomes.map((outcome) => outcome.replayed).sort()).toEqual([false, true]);
    expect(outcomes[0]?.result).toEqual(outcomes[1]?.result);
    // A losing transaction can execute its callback before it rolls back.
    expect(executions).toBeGreaterThanOrEqual(1);
    expect(await Event.countDocuments()).toBe(1);
  });

  it("round-trips an empty JSON result", async () => {
    const input = {
      connection: client.connection,
      scope: "webhook" as const,
      subject: "mbway-sandbox",
      key: "provider-event-empty",
      request: { event: "ignored" },
      retentionMs: 86_400_000,
      execute: async () => ({}),
    };
    expect(await runIdempotentOperation(input)).toEqual({ result: {}, replayed: false });
    expect(await runIdempotentOperation(input)).toEqual({ result: {}, replayed: true });
  });
});
