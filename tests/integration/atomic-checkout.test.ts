import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { submitAtomicCheckout } from "@/server/modules/orders";
import { getCheckoutInitiationModel } from "@/server/modules/orders/model/checkout-initiation";
import { getOrderModel } from "@/server/modules/orders/model/order";
import { getOrderNotificationModel } from "@/server/modules/orders/model/order-notification";
import { getTransactionModel } from "@/server/modules/transactions/model/transaction";
import { FakePaymentProvider } from "@/server/modules/transactions/provider/fake-payment-provider";

import { startTestMongoReplicaSet, type TestMongoDatabase } from "../helpers/mongodb";

const at = new Date("2026-10-14T12:00:00.000Z");
const phone = "+351912345678";

describe("atomic checkout", () => {
  let database: TestMongoDatabase;
  let client: Mongoose;
  let customerId: Types.ObjectId;
  let dishId: Types.ObjectId;
  let policies: { id: string; version: number }[];

  beforeAll(async () => {
    database = await startTestMongoReplicaSet("sara-kitchen-atomic-checkout-test");
    client = new Mongoose();
    await client.connect(database.uri);
    await Promise.all([
      getOrderModel(client.connection).syncIndexes(),
      getOrderNotificationModel(client.connection).syncIndexes(),
      getTransactionModel(client.connection).syncIndexes(),
      getCheckoutInitiationModel(client.connection).syncIndexes(),
      client.connection
        .collection("idempotency_records")
        .createIndex({ scope: 1, subject: 1, key: 1 }, { unique: true }),
      client.connection
        .collection("policy_consents")
        .createIndex({ subjectKind: 1, subjectId: 1, policyVersionId: 1 }, { unique: true }),
    ]);
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
      "checkout_initiations",
      "idempotency_records",
      "carts",
      "customers",
      "dishes",
      "policy_versions",
      "policy_consents",
    ]) {
      await client.connection.collection(name).deleteMany({});
    }
    customerId = new Types.ObjectId();
    dishId = new Types.ObjectId();
    const policyIds = [new Types.ObjectId(), new Types.ObjectId()];
    policies = policyIds.map((id) => ({ id: id.toHexString(), version: 1 }));
    await client.connection.collection("customers").insertOne({
      _id: customerId,
      firstName: "Sara",
      lastName: "Kazemi",
      mobile: phone,
      email: "sara@example.test",
      status: "active",
      deletedAt: null,
    });
    await client.connection.collection("dishes").insertOne({
      _id: dishId,
      status: "published",
      deletedAt: null,
      slug: "fesenjan",
      translations: [{ locale: "en", name: "Fesenjan" }],
      portionAmount: 1,
      portionUnit: "serving",
      leadTimeMinutes: 60,
      maxQuantityPerOrder: 10,
      availability: { mode: "available", availableFrom: null, availableUntil: null },
      basePriceCents: 1_200,
      discount: {
        type: "fixed",
        amountCents: 200,
        basisPoints: null,
        startsAt: null,
        endsAt: null,
      },
    });
    await client.connection.collection("carts").insertOne({
      _id: new Types.ObjectId(),
      customerId,
      guestTokenHash: null,
      status: "active",
      version: 1,
      lines: [{ dishId, quantity: 2 }],
      selectedAddressId: null,
      pickupConfirmed: true,
      notes: null,
      pricing: {
        subtotalCents: 2_400,
        discountCents: 400,
        deliveryFeeCents: 0,
        taxCents: 0,
        adjustmentsCents: 0,
        totalCents: 2_000,
        calculatedAt: at,
      },
      expiresAt: new Date(at.getTime() + 86_400_000),
      absoluteExpiresAt: null,
      purgeAt: null,
    });
    await client.connection.collection("policy_versions").insertMany(
      policyIds.map((id, index) => ({
        _id: id,
        documentType: index === 0 ? "terms-of-service" : "privacy-policy",
        version: 1,
        state: "published",
        effectiveAt: new Date(at.getTime() - 86_400_000),
        contentDigest: "a".repeat(64),
        translations: [
          {
            locale: "en",
            title: index === 0 ? "Terms" : "Privacy",
            summary: "Current",
            sections: [],
          },
        ],
      })),
    );
  });

  function checkout(
    provider = new FakePaymentProvider("a".repeat(32)),
    overrides: Record<string, unknown> = {},
  ) {
    return submitAtomicCheckout({
      connection: client.connection,
      customerId: customerId.toHexString(),
      locale: "en",
      idempotencyKey: "checkout-key-123456",
      submission: {
        expectedCartVersion: 1,
        paymentMethod: "mbway",
        paymentPhone: phone,
        acceptedPolicies: policies,
      },
      deliveryBands: [{ maxDistanceMeters: 20_000, feeCents: 400 }],
      kitchen: { latitude: 41.15, longitude: -8.61 },
      serviceRadiusKm: null,
      provider,
      now: () => at,
      ...overrides,
    });
  }

  it("commits one authoritative order/payment/cart conversion and replays without re-initiating", async () => {
    const provider = new FakePaymentProvider("a".repeat(32));
    const first = await checkout(provider);
    expect(first).toMatchObject({ paymentStatus: "pending", replayed: false });
    const second = await checkout(provider);
    expect(second).toMatchObject({
      orderCode: first.orderCode,
      paymentStatus: "pending",
      replayed: true,
    });
    expect(await getOrderModel(client.connection).countDocuments()).toBe(1);
    expect(await client.connection.collection("policy_consents").countDocuments()).toBe(2);
    const order = await getOrderModel(client.connection).findById(first.orderId);
    expect(order?.pricing.totalCents).toBe(2_000);
    expect(order?.items[0]).toMatchObject({
      baseUnitPriceCents: 1_200,
      effectiveUnitPriceCents: 1_000,
      quantity: 2,
    });
    expect(
      (await getTransactionModel(client.connection).findById(first.transactionId))?.status,
    ).toBe("pending");
    expect((await client.connection.collection("carts").findOne({ customerId }))?.status).toBe(
      "converted",
    );
    expect(
      (await client.connection.collection("idempotency_records").findOne({ scope: "checkout" }))
        ?.result,
    ).not.toContain(phone);
    await expect(
      checkout(provider, {
        submission: {
          expectedCartVersion: 1,
          paymentMethod: "mbway",
          paymentPhone: phone,
          acceptedPolicies: [...policies].reverse(),
        },
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("rolls back every write when authoritative pricing fails", async () => {
    await expect(
      checkout(undefined, { deliveryBands: [{ maxDistanceMeters: 0, feeCents: -1 }] }),
    ).rejects.toThrow();
    expect(await getOrderModel(client.connection).countDocuments()).toBe(0);
    expect(await getTransactionModel(client.connection).countDocuments()).toBe(0);
    expect(await getCheckoutInitiationModel(client.connection).countDocuments()).toBe(0);
    expect(await client.connection.collection("policy_consents").countDocuments()).toBe(0);
    expect((await client.connection.collection("carts").findOne({ customerId }))?.status).toBe(
      "active",
    );
    expect(await client.connection.collection("idempotency_records").countDocuments()).toBe(0);
  });

  it("rolls back an already-written order and transaction if consent persistence fails", async () => {
    await client.connection
      .collection("policy_versions")
      .updateOne({ _id: new Types.ObjectId(policies[0]!.id) }, { $set: { contentDigest: null } });
    await expect(checkout()).rejects.toThrow();
    expect(await getOrderModel(client.connection).countDocuments()).toBe(0);
    expect(await getTransactionModel(client.connection).countDocuments()).toBe(0);
    expect(await getCheckoutInitiationModel(client.connection).countDocuments()).toBe(0);
    expect(await client.connection.collection("policy_consents").countDocuments()).toBe(0);
    expect((await client.connection.collection("carts").findOne({ customerId }))?.status).toBe(
      "active",
    );
  });

  it("rejects a changed server price until the customer reviews the cart", async () => {
    await client.connection
      .collection("dishes")
      .updateOne({ _id: dishId }, { $set: { basePriceCents: 1_300 } });
    await expect(checkout()).rejects.toMatchObject({ status: 409 });
    expect(await getOrderModel(client.connection).countDocuments()).toBe(0);
    expect(await getTransactionModel(client.connection).countDocuments()).toBe(0);
    expect((await client.connection.collection("carts").findOne({ customerId }))?.status).toBe(
      "active",
    );
  });

  it("leaves an explicit reconciliation record after an uncertain provider outcome and never retries initiation", async () => {
    const initiate = vi.fn().mockRejectedValue(new Error("lost_response"));
    const provider = {
      id: "mbway-sandbox",
      capabilities: { cancel: true, refund: false, webhook: true },
      initiate,
    } as unknown as FakePaymentProvider;
    const first = await checkout(provider);
    const replay = await checkout(provider);
    expect(first.paymentStatus).toBe("needs_reconciliation");
    expect(replay.orderId).toBe(first.orderId);
    expect(initiate).toHaveBeenCalledTimes(1);
    expect(
      (await getCheckoutInitiationModel(client.connection).findOne({ orderId: first.orderId }))
        ?.state,
    ).toBe("needs_reconciliation");
    expect(await getOrderModel(client.connection).countDocuments()).toBe(1);
    expect(await getTransactionModel(client.connection).countDocuments()).toBe(1);
  });
});
