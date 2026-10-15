import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createOrderManagement, OrderManagementError } from "@/server/modules/orders";
import { getOrderModel } from "@/server/modules/orders/model/order";
import { getOrderNotificationModel } from "@/server/modules/orders/model/order-notification";
import { getAuditLogModel } from "@/server/modules/logs/model/audit-log";

import { startTestMongoReplicaSet, type TestMongoDatabase } from "../helpers/mongodb";
import { validOrder } from "../helpers/order";

describe("order management boundaries", () => {
  let database: TestMongoDatabase;
  let client: Mongoose;
  const managerId = new Types.ObjectId();
  const manager = { id: managerId.toString(), role: "manager" as const, active: true as const };
  const viewer = {
    id: new Types.ObjectId().toString(),
    role: "viewer" as const,
    active: true as const,
  };

  beforeAll(async () => {
    database = await startTestMongoReplicaSet("sara-kitchen-order-management-test");
    client = new Mongoose();
    await client.connect(database.uri);
    await getOrderModel(client.connection).syncIndexes();
    await getOrderNotificationModel(client.connection).syncIndexes();
    await getAuditLogModel(client.connection).syncIndexes();
  }, 120_000);

  afterAll(async () => {
    await client?.disconnect();
    await database?.stop();
  });

  beforeEach(async () => {
    for (const name of ["orders", "order_notifications", "transactions", "audit_logs"])
      await client.connection.collection(name).deleteMany({});
  });

  async function fixture(paymentStatus: "pending" | "cancelled" | "paid" = "pending") {
    const base = validOrder();
    const [order] = await getOrderModel(client.connection).create([base]);
    await client.connection.collection("transactions").insertOne({
      _id: order!.transactionIds[0]!,
      orderId: order!._id,
      customerId: order!.customerId,
      currency: "EUR",
      amounts: { requestedCents: 1_800 },
      status: paymentStatus,
      idempotencyKeyHash: order!._id.toString().padEnd(64, "a"),
    });
    return order!;
  }

  const service = () =>
    createOrderManagement(client.connection, {
      requestId: "order-management-test",
      userAgent: "Vitest",
    });

  it("gates reads and redacts sensitive customer snapshots", async () => {
    const order = await fixture();
    const listed = await service().list(manager, { page: 1, pageSize: 20, sortDirection: "desc" });
    expect(listed.total).toBe(1);
    expect(listed.items[0]?.customer?.mobile).toBe("+351912345678");
    await expect(service().get(viewer, order.code)).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      service().list(viewer, { page: 1, pageSize: 20, sortDirection: "desc" }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("allows an internal note but never changes a purchase snapshot", async () => {
    const order = await fixture();
    const result = await service().setInternalNote(manager, order.code, {
      expectedRevision: 1,
      expectedManagementRevision: 0,
      internalNote: "Call before pickup",
    });
    expect(result.internalNote).toBe("Call before pickup");
    expect(result.managementRevision).toBe(1);
    await expect(
      service().setInternalNote(manager, order.code, {
        expectedRevision: 1,
        expectedManagementRevision: 0,
        internalNote: "Stale overwrite",
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    const saved = await getOrderModel(client.connection).findById(order._id);
    expect(saved?.notes).toBe("No onions, please");
    expect(saved?.customerSnapshot.mobile).toBe("+351912345678");
    expect(
      await client.connection
        .collection("audit_logs")
        .countDocuments({ actionCode: "crud.resource.update" }),
    ).toBe(1);
    expect(() => service().assignCustomer(manager)).toThrow(OrderManagementError);
  });

  it("rejects fulfillment before payment and cancellation without provider cancellation", async () => {
    const order = await fixture();
    await expect(
      service().transition(manager, order.code, {
        expectedRevision: 1,
        status: "preparing",
        reasonCode: null,
      }),
    ).rejects.toThrow();
    await expect(
      service().transition(manager, order.code, {
        expectedRevision: 1,
        status: "cancelled",
        reasonCode: "customer_request",
      }),
    ).rejects.toThrow();
    const saved = await getOrderModel(client.connection).findById(order._id);
    expect(saved?.revision).toBe(1);
    expect(await client.connection.collection("audit_logs").countDocuments()).toBe(0);
  });

  it("cancels only after matching provider cancellation and rejects stale revision", async () => {
    const order = await fixture("cancelled");
    const changed = await service().transition(manager, order.code, {
      expectedRevision: 1,
      status: "cancelled",
      reasonCode: "customer_request",
    });
    expect(changed.order.status).toBe("cancelled");
    expect(changed.order.revision).toBe(2);
    expect(changed.effects.refundFollowUpRequired).toBe(false);
    await expect(
      service().transition(manager, order.code, {
        expectedRevision: 1,
        status: "cancelled",
        reasonCode: "customer_request",
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(
      await client.connection
        .collection("audit_logs")
        .countDocuments({ actionCode: "order.order.status-change" }),
    ).toBe(1);
  });

  it("lets only the owning customer cancel a provider-cancelled pending order", async () => {
    const order = await fixture("cancelled");
    await expect(
      service().cancelCustomer(new Types.ObjectId().toString(), order.code, {
        expectedRevision: 1,
        reasonCode: "customer_request",
      }),
    ).rejects.toMatchObject({ code: "not_found" });
    const result = await service().cancelCustomer(order.customerId.toString(), order.code, {
      expectedRevision: 1,
      reasonCode: "customer_request",
    });
    expect(result.order.status).toBe("cancelled");
    expect(result.order.internalNote).toBeNull();
    expect(result.order.statusHistory.at(-1)?.actorKind).toBe("customer");
    expect(
      await client.connection
        .collection("audit_logs")
        .countDocuments({ "actor.kind": "customer", actionCode: "order.order.status-change" }),
    ).toBe(1);
  });

  it("advances a paid order through the authorized fulfillment state machine", async () => {
    const base = validOrder();
    const confirmedAt = new Date("2026-10-14T10:05:00.000Z");
    const [order] = await getOrderModel(client.connection).create([
      validOrder({
        status: "confirmed",
        revision: 2,
        statusHistory: [
          ...base.statusHistory,
          {
            eventKey: "provider:paid",
            status: "confirmed",
            actorKind: "system",
            actorId: null,
            reasonCode: null,
            paymentStatus: "paid",
            occurredAt: confirmedAt,
            recordedAt: confirmedAt,
          },
        ],
      }),
    ]);
    await client.connection.collection("transactions").insertOne({
      _id: order!.transactionIds[0]!,
      orderId: order!._id,
      customerId: order!.customerId,
      currency: "EUR",
      amounts: { requestedCents: 1_800 },
      status: "paid",
      idempotencyKeyHash: order!._id.toString().padEnd(64, "d"),
    });
    const result = await service().transition(manager, order!.code, {
      expectedRevision: 2,
      status: "preparing",
      reasonCode: null,
    });
    expect(result.order.status).toBe("preparing");
    expect(result.order.revision).toBe(3);
    await expect(
      service().transition(viewer, order!.code, {
        expectedRevision: 3,
        status: "ready",
        reasonCode: null,
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    const cancelled = await service().transition(manager, order!.code, {
      expectedRevision: 3,
      status: "cancelled",
      reasonCode: "kitchen_unavailable",
    });
    expect(cancelled.order.refundFollowUpRequired).toBe(true);
    expect(cancelled.effects.refundFollowUpRequired).toBe(true);
  });

  it("attaches only an order-matched retry transaction after a terminal failed attempt", async () => {
    const order = await fixture("cancelled");
    const nextId = new Types.ObjectId();
    await client.connection.collection("transactions").insertOne({
      _id: nextId,
      orderId: order._id,
      customerId: order.customerId,
      currency: "EUR",
      amounts: { requestedCents: 1_800 },
      status: "created",
      idempotencyKeyHash: nextId.toString().padEnd(64, "b"),
    });
    const changed = await service().attachTransaction(manager, order.code, {
      expectedRevision: 1,
      expectedManagementRevision: 0,
      transactionId: nextId.toString(),
    });
    expect(changed.transactionIds).toHaveLength(2);
    const replay = await service().attachTransaction(manager, order.code, {
      expectedRevision: 1,
      expectedManagementRevision: 1,
      transactionId: nextId.toString(),
    });
    expect(replay.transactionIds).toHaveLength(2);
  });

  it("rejects a foreign payment link and an unauthorized transaction action", async () => {
    const order = await fixture("cancelled");
    const foreignId = new Types.ObjectId();
    await client.connection.collection("transactions").insertOne({
      _id: foreignId,
      orderId: new Types.ObjectId(),
      customerId: order.customerId,
      currency: "EUR",
      amounts: { requestedCents: 1_800 },
      status: "created",
      idempotencyKeyHash: foreignId.toString().padEnd(64, "c"),
    });
    await expect(
      service().attachTransaction(manager, order.code, {
        expectedRevision: 1,
        expectedManagementRevision: 0,
        transactionId: foreignId.toString(),
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      service().attachTransaction(viewer, order.code, {
        expectedRevision: 1,
        expectedManagementRevision: 0,
        transactionId: foreignId.toString(),
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(
      (await getOrderModel(client.connection).findById(order._id))?.transactionIds,
    ).toHaveLength(1);
  });
});
