import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getDashboardAggregation, resolveDashboardPeriods } from "@/server/modules/analytics";
import { getCategoryModel } from "@/server/modules/categories/model/category";
import { getCustomerModel } from "@/server/modules/customers/model/customer";
import { getDishModel } from "@/server/modules/dishes/model/dish";
import { getDishViewReceiptModel } from "@/server/modules/dishes/model/dish-view-receipt";
import { getAuditLogModel } from "@/server/modules/logs/model/audit-log";
import { getOrderModel } from "@/server/modules/orders/model/order";
import { getTransactionModel } from "@/server/modules/transactions/model/transaction";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

const owner = { id: new Types.ObjectId().toString(), role: "owner" as const, active: true };
const asOf = new Date("2026-10-16T12:00:00.000Z");
const on = (date: string) => new Date(`${date}T10:00:00.000Z`);

describe("dashboard aggregation", () => {
  let database: TestMongoDatabase;
  let client: Mongoose;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-dashboard-aggregation-test");
    client = new Mongoose();
    await client.connect(database.uri);
    await Promise.all([
      getCategoryModel(client.connection).syncIndexes(),
      getCustomerModel(client.connection).syncIndexes(),
      getDishModel(client.connection).syncIndexes(),
      getDishViewReceiptModel(client.connection).syncIndexes(),
      getAuditLogModel(client.connection).syncIndexes(),
      getOrderModel(client.connection).syncIndexes(),
      getTransactionModel(client.connection).syncIndexes(),
    ]);
  }, 120_000);

  afterAll(async () => {
    await client?.disconnect();
    await database?.stop();
  });

  it("reconciles capture and refund periods, ranking, status counts and indexed sources", async () => {
    const customerId = new Types.ObjectId();
    const dishId = new Types.ObjectId();
    const orderId = new Types.ObjectId();
    const oldOrderId = new Types.ObjectId();
    await client.connection.collection("customers").insertOne({
      _id: customerId,
      firstName: "Sara",
      lastName: "Kazemi",
      status: "active",
      createdAt: on("2026-10-15"),
    });
    await client.connection.collection("dishes").insertOne({
      _id: dishId,
      slug: "fesenjan",
      status: "published",
      deletedAt: null,
      translations: [{ locale: "en", name: "Fesenjan" }],
      viewCount: 7,
    });
    await client.connection
      .collection("categories")
      .insertOne({ status: "published", deletedAt: null });
    await client.connection.collection("orders").insertMany([
      {
        _id: orderId,
        code: "SK-TEST1",
        customerId,
        status: "completed",
        createdAt: on("2026-10-15"),
        pricing: { totalCents: 1_800 },
        items: [{ dishId, name: "Fesenjan", quantity: 2, lineSubtotalCents: 1_800 }],
        statusHistory: [
          { status: "pending_payment", occurredAt: on("2026-10-15") },
          { status: "completed", occurredAt: on("2026-10-16") },
        ],
      },
      {
        _id: oldOrderId,
        code: "SK-TEST2",
        customerId,
        status: "refunded",
        createdAt: on("2026-10-10"),
        pricing: { totalCents: 500 },
        items: [{ dishId, name: "Fesenjan", quantity: 1, lineSubtotalCents: 500 }],
        statusHistory: [
          { status: "completed", occurredAt: on("2026-10-10") },
          { status: "refunded", occurredAt: on("2026-10-15") },
        ],
      },
    ]);
    await client.connection.collection("transactions").insertMany([
      {
        orderId,
        customerId,
        idempotencyKeyHash: "a".repeat(64),
        createdAt: on("2026-10-15"),
        events: [{ status: "paid", amountCents: 1_800, occurredAt: on("2026-10-15") }],
      },
      {
        orderId: oldOrderId,
        customerId,
        idempotencyKeyHash: "b".repeat(64),
        createdAt: on("2026-10-10"),
        events: [
          { status: "paid", amountCents: 500, occurredAt: on("2026-10-10") },
          { status: "refunded", amountCents: 500, occurredAt: on("2026-10-16") },
        ],
      },
    ]);

    const result = await getDashboardAggregation(client.connection, owner, {
      startDate: "2026-10-14",
      endDate: "2026-10-16",
      asOf,
    });
    expect(result.totals).toMatchObject({
      grossSalesCents: 1_800,
      refundsCents: 500,
      netSalesCents: 1_300,
      paidOrders: 1,
      ordersCreated: 1,
      uniquePayingCustomers: 1,
      registeredCustomers: 1,
      publishedDishes: 1,
      publishedCategories: 1,
      meaningfulDishViews: null,
    });
    expect(result.salesChart).toHaveLength(3);
    expect(result.salesChart.reduce((sum, day) => sum + day.netCents, 0)).toBe(1_300);
    expect(result.orderStatusCounts).toMatchObject({ completed: 1, refunded: 1 });
    expect(result.bestCustomer).toMatchObject({
      customerId: customerId.toString(),
      netCents: 1_300,
      displayName: "Sara Kazemi",
    });
    expect(result.topSellingDish).toMatchObject({ dishId: dishId.toString(), netUnits: 1 });
    expect(result.mostVisitedDishes).toMatchObject({ scope: "lifetime", items: [{ views: 7 }] });
    expect(result.recentOrders).toHaveLength(2);

    const transactionIndexes = (await client.connection.collection("transactions").indexes()).map(
      (index) => index.name,
    );
    const orderIndexes = (await client.connection.collection("orders").indexes()).map(
      (index) => index.name,
    );
    expect(transactionIndexes).toContain("transaction_financial_event_period");
    expect(orderIndexes).toContain("order_status_event_period");
    const transactionPlan = await client.connection
      .collection("transactions")
      .aggregate([{ $match: { "events.occurredAt": { $gte: on("2026-10-14"), $lt: asOf } } }], {
        hint: "transaction_financial_event_period",
      })
      .explain();
    expect(JSON.stringify(transactionPlan)).toContain("transaction_financial_event_period");
    const orderPlan = await client.connection
      .collection("orders")
      .aggregate(
        [{ $match: { "statusHistory.occurredAt": { $gte: on("2026-10-14"), $lt: asOf } } }],
        { hint: "order_status_event_period" },
      )
      .explain();
    expect(JSON.stringify(orderPlan)).toContain("order_status_event_period");
  }, 60_000);

  it("uses Lisbon DST boundaries and rejects expensive ranges or unauthorized reads", async () => {
    const spring = resolveDashboardPeriods({
      startDate: "2026-03-29",
      endDate: "2026-03-29",
      asOf: new Date("2026-03-30T12:00:00Z"),
    });
    expect(spring.period.end.getTime() - spring.period.start.getTime()).toBe(23 * 60 * 60_000);
    const autumn = resolveDashboardPeriods({
      startDate: "2026-10-25",
      endDate: "2026-10-25",
      asOf: new Date("2026-10-26T12:00:00Z"),
    });
    expect(autumn.period.end.getTime() - autumn.period.start.getTime()).toBe(25 * 60 * 60_000);
    expect(() =>
      resolveDashboardPeriods({ startDate: "2024-01-01", endDate: "2026-10-16", asOf }),
    ).toThrow();
    await expect(
      getDashboardAggregation(client.connection, { ...owner, role: "viewer" }, { asOf }),
    ).rejects.toThrow("access denied");
  });
});
