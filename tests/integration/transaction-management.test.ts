import { createHash } from "node:crypto";

import { Mongoose, Types } from "mongoose";
import type { ClientSession } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { applyVerifiedPaymentStateToOrder } from "@/server/modules/orders";
import { getOrderModel } from "@/server/modules/orders/model/order";
import { getOrderNotificationModel } from "@/server/modules/orders/model/order-notification";
import { getAuditLogModel } from "@/server/modules/logs/model/audit-log";
import {
  createTransactionManagement,
  reconcilePayments,
  type VerifiedPaymentState,
} from "@/server/modules/transactions";
import { getPaymentReconciliationModel } from "@/server/modules/transactions/model/payment-reconciliation";
import { getTransactionModel } from "@/server/modules/transactions/model/transaction";
import { FakePaymentProvider } from "@/server/modules/transactions/provider/fake-payment-provider";
import type { PaymentProvider } from "@/server/modules/transactions/provider/payment-provider";

import { startTestMongoReplicaSet, type TestMongoDatabase } from "../helpers/mongodb";
import { validOrder } from "../helpers/order";

const secret = "transaction-management-test-secret-long-enough";
const at = new Date("2026-10-14T12:00:00.000Z");
const manager = {
  id: new Types.ObjectId().toString(),
  role: "manager" as const,
  active: true as const,
};
const owner = {
  id: new Types.ObjectId().toString(),
  role: "owner" as const,
  active: true as const,
};
const viewer = {
  id: new Types.ObjectId().toString(),
  role: "viewer" as const,
  active: true as const,
};

describe("transaction management", () => {
  let database: TestMongoDatabase;
  let client: Mongoose;
  let fake: FakePaymentProvider;
  let provider: PaymentProvider;

  beforeAll(async () => {
    database = await startTestMongoReplicaSet("sara-kitchen-transaction-management-test");
    client = new Mongoose();
    await client.connect(database.uri);
    await getOrderModel(client.connection).syncIndexes();
    await getOrderNotificationModel(client.connection).syncIndexes();
    await getTransactionModel(client.connection).syncIndexes();
    await getPaymentReconciliationModel(client.connection).syncIndexes();
    await getAuditLogModel(client.connection).syncIndexes();
  }, 120_000);

  afterAll(async () => {
    await client?.disconnect();
    await database?.stop();
  });

  beforeEach(async () => {
    for (const name of [
      "orders",
      "order_notifications",
      "transactions",
      "payment_reconciliations",
      "audit_logs",
      "dish_sold_projections",
    ])
      await client.connection.collection(name).deleteMany({});
    fake = new FakePaymentProvider(secret, () => at);
    provider = {
      id: "mbway-sandbox",
      capabilities: fake.capabilities,
      initiate: (input) => fake.initiate(input),
      fetchStatus: (id) => fake.fetchStatus(id),
      cancel: (input) => fake.cancel(input),
      refund: (input) => fake.refund(input),
      verifyWebhook: (input) => fake.verifyWebhook(input),
      mapEvent: (input) => fake.mapEvent(input),
    };
  });

  async function fixture() {
    const orderId = new Types.ObjectId();
    const transactionId = new Types.ObjectId();
    const order = await getOrderModel(client.connection).create(
      validOrder({ _id: orderId, transactionIds: [transactionId] }),
    );
    const response = await fake.initiate({
      transactionId: transactionId.toString(),
      orderId: orderId.toString(),
      amountCents: 1_800,
      currency: "EUR",
      idempotencyKey: `fixture_${transactionId}`,
    });
    const transaction = await getTransactionModel(client.connection).create({
      _id: transactionId,
      orderId,
      customerId: order.customerId,
      method: "mbway",
      provider: "mbway-sandbox",
      currency: "EUR",
      amounts: { requestedCents: 1_800 },
      status: "pending",
      providerReferences: {
        paymentId: response.providerPaymentId,
        requestId: response.providerRequestId,
      },
      idempotencyKeyHash: createHash("sha256").update(transactionId.toString()).digest("hex"),
      events: [
        {
          eventKey: "initial",
          source: "system",
          status: "created",
          amountCents: null,
          occurredAt: at,
        },
        {
          eventKey: "initiated",
          source: "system",
          status: "pending",
          amountCents: null,
          occurredAt: at,
        },
      ],
    });
    return { order, transaction, response };
  }

  const service = () =>
    createTransactionManagement(client.connection, {
      requestId: "transaction-management-test",
      userAgent: "Vitest",
    });
  const sync = (session: ClientSession, state: VerifiedPaymentState) =>
    applyVerifiedPaymentStateToOrder(
      client.connection,
      state,
      session,
      "transaction-management-test",
    ).then(() => undefined);

  it("gates reads and permits only an audited internal-note edit", async () => {
    const { transaction } = await fixture();
    const listed = await service().list(manager, { page: 1, pageSize: 20, sortDirection: "desc" });
    expect(listed.total).toBe(1);
    expect(listed.items[0]?.providerReferences?.paymentId).toMatch(/^fake_payment_/u);
    await expect(service().get(viewer, transaction._id.toString())).rejects.toMatchObject({
      code: "forbidden",
    });
    const edited = await service().setInternalNote(manager, transaction._id.toString(), {
      expectedManagementRevision: 0,
      internalNote: "Phone callback pending",
    });
    expect(edited.managementRevision).toBe(1);
    await expect(
      service().setInternalNote(manager, transaction._id.toString(), {
        expectedManagementRevision: 0,
        internalNote: "stale",
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    const saved = await getTransactionModel(client.connection).findById(transaction._id);
    expect(saved?.amounts.requestedCents).toBe(1_800);
    expect(saved?.events).toHaveLength(2);
    expect(
      await client.connection
        .collection("audit_logs")
        .countDocuments({ actionCode: "crud.resource.update" }),
    ).toBe(1);
  });

  it("reconciles a provider capture once and atomically confirms the order", async () => {
    const { order, transaction, response } = await fixture();
    fake.simulateEvent(response.providerPaymentId, "PAID", 1_800, "payment_capture_1");
    expect(await fake.fetchStatus(response.providerPaymentId)).toMatchObject({
      status: "paid",
      amounts: {
        requestedCents: 1_800,
        authorizedCents: 0,
        capturedCents: 1_800,
        refundedCents: 0,
      },
    });
    const result = await service().reconcile(manager, transaction._id.toString(), provider, sync);
    expect(result.changed).toBe(true);
    expect(result.transaction.status).toBe("paid");
    expect((await getOrderModel(client.connection).findById(order._id))?.status).toBe("confirmed");
    const replay = await service().reconcile(manager, transaction._id.toString(), provider, sync);
    expect(replay.changed).toBe(false);
    expect(
      (await getTransactionModel(client.connection).findById(transaction._id))?.events,
    ).toHaveLength(3);
    expect(
      await client.connection
        .collection("audit_logs")
        .countDocuments({ actionCode: "payment.transaction.process" }),
    ).toBe(1);
  });

  it("detects and repairs a missed webhook through the bounded reconciliation worker", async () => {
    const { order, transaction, response } = await fixture();
    fake.simulateEvent(response.providerPaymentId, "PAID", 1_800, "missed_webhook_capture");
    const workerNow = new Date(transaction.updatedAt.getTime() + 10 * 60_000);

    const summary = await reconcilePayments(
      client.connection,
      (providerId) => (providerId === "mbway-sandbox" ? provider : null),
      sync,
      { now: () => workerNow, staleAfterMs: 5 * 60_000, requestId: "missed-webhook-test" },
    );

    expect(summary).toMatchObject({ discovered: 1, checked: 1, resolved: 1, alerted: 0 });
    expect((await getTransactionModel(client.connection).findById(transaction._id))?.status).toBe(
      "paid",
    );
    expect((await getOrderModel(client.connection).findById(order._id))?.status).toBe("confirmed");
    expect(
      await getPaymentReconciliationModel(client.connection).findOne({
        transactionId: transaction._id,
      }),
    ).toMatchObject({ state: "resolved", attempts: 1, lastErrorCode: null });

    const replay = await reconcilePayments(client.connection, () => provider, sync, {
      now: () => workerNow,
      staleAfterMs: 0,
    });
    expect(replay.checked).toBe(0);
  });

  it("durably alerts on a provider mismatch without changing financial state", async () => {
    const { order, transaction, response } = await fixture();
    const mismatch: PaymentProvider = {
      ...provider,
      fetchStatus: async () => ({
        ...(await fake.fetchStatus(response.providerPaymentId)),
        amounts: { requestedCents: 1_801, authorizedCents: 0, capturedCents: 0, refundedCents: 0 },
      }),
    };
    const alerts: string[] = [];
    const workerNow = new Date(transaction.updatedAt.getTime() + 10 * 60_000);
    const summary = await reconcilePayments(client.connection, () => mismatch, sync, {
      now: () => workerNow,
      onAlert: (alert) => {
        alerts.push(alert.errorCode);
      },
    });
    expect(summary).toMatchObject({ checked: 1, alerted: 1, openAlerts: 1 });
    expect(alerts).toEqual(["transaction_conflict"]);
    expect((await getTransactionModel(client.connection).findById(transaction._id))?.status).toBe(
      "pending",
    );
    expect((await getOrderModel(client.connection).findById(order._id))?.status).toBe(
      "pending_payment",
    );
  });

  it("reschedules a successfully checked payment that is still pending", async () => {
    const { transaction } = await fixture();
    const workerNow = new Date(transaction.updatedAt.getTime() + 10 * 60_000);
    const summary = await reconcilePayments(client.connection, () => provider, sync, {
      now: () => workerNow,
    });
    expect(summary).toMatchObject({ checked: 1, resolved: 0, retried: 1, alerted: 0 });
    expect(
      await getPaymentReconciliationModel(client.connection).findOne({
        transactionId: transaction._id,
      }),
    ).toMatchObject({
      state: "pending",
      attempts: 1,
      lastErrorCode: "provider_still_pending",
    });
  });

  it("cancels only through provider confirmation, then updates the order", async () => {
    const { order, transaction } = await fixture();
    const result = await service().cancel(
      manager,
      transaction._id.toString(),
      provider,
      "cancel_action_1",
      sync,
    );
    expect(result.transaction.status).toBe("cancelled");
    expect((await getOrderModel(client.connection).findById(order._id))?.status).toBe("cancelled");
    await expect(
      service().cancel(manager, transaction._id.toString(), provider, "cancel_action_1", sync),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("rejects provider amount mismatches without changing money or order", async () => {
    const { order, transaction, response } = await fixture();
    const mismatch: PaymentProvider = {
      ...provider,
      fetchStatus: async () => ({
        ...(await fake.fetchStatus(response.providerPaymentId)),
        amounts: { requestedCents: 1_801, authorizedCents: 0, capturedCents: 0, refundedCents: 0 },
      }),
    };
    await expect(
      service().reconcile(manager, transaction._id.toString(), mismatch, sync),
    ).rejects.toMatchObject({ code: "conflict" });
    expect((await getTransactionModel(client.connection).findById(transaction._id))?.status).toBe(
      "pending",
    );
    expect((await getOrderModel(client.connection).findById(order._id))?.status).toBe(
      "pending_payment",
    );
  });

  it("rolls back the transaction and audit when order synchronization fails", async () => {
    const { order, transaction, response } = await fixture();
    fake.simulateEvent(response.providerPaymentId, "PAID", 1_800, "payment_capture_rollback");
    let callbackCalled = false;
    await expect(
      service().reconcile(manager, transaction._id.toString(), provider, async () => {
        callbackCalled = true;
        throw new Error("injected order sync failure");
      }),
    ).rejects.toThrow();
    expect(callbackCalled).toBe(true);
    expect((await getTransactionModel(client.connection).findById(transaction._id))?.status).toBe(
      "pending",
    );
    expect((await getOrderModel(client.connection).findById(order._id))?.status).toBe(
      "pending_payment",
    );
    expect(await client.connection.collection("audit_logs").countDocuments({})).toBe(0);
    const recovered = await service().reconcile(
      manager,
      transaction._id.toString(),
      provider,
      sync,
    );
    expect(recovered.transaction.status).toBe("paid");
    expect((await getOrderModel(client.connection).findById(order._id))?.status).toBe("confirmed");
  });

  it("requires refund permission and provider capability; confirmed refund is append-only", async () => {
    const { order, transaction, response } = await fixture();
    fake.simulateEvent(response.providerPaymentId, "PAID", 1_800, "paid_for_refund");
    await service().reconcile(manager, transaction._id.toString(), provider, sync);
    await expect(
      service().refund(
        manager,
        transaction._id.toString(),
        provider,
        { amountCents: 1_800, idempotencyKey: "refund_action_1" },
        sync,
      ),
    ).rejects.toMatchObject({ code: "forbidden" });
    const unsupported: PaymentProvider = {
      ...provider,
      capabilities: { ...provider.capabilities, refund: false },
    };
    await expect(
      service().refund(
        owner,
        transaction._id.toString(),
        unsupported,
        { amountCents: 1_800, idempotencyKey: "refund_action_1" },
        sync,
      ),
    ).rejects.toMatchObject({ code: "unsupported" });
    const result = await service().refund(
      owner,
      transaction._id.toString(),
      provider,
      { amountCents: 1_800, idempotencyKey: "refund_action_1" },
      sync,
    );
    expect(result.transaction.status).toBe("refunded");
    expect(result.transaction.amounts.refundedCents).toBe(1_800);
    expect((await getOrderModel(client.connection).findById(order._id))?.status).toBe("refunded");
    const saved = await getTransactionModel(client.connection).findById(transaction._id);
    expect(saved?.events).toHaveLength(4);
  });
});
