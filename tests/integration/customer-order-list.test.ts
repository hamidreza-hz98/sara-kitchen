import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  customerOrderStatusFilter,
  getCustomerOrderSummaryByCode,
  listCustomerOrders,
} from "@/server/modules/orders/service/customer-order-list";
import { getOrderModel } from "@/server/modules/orders/model/order";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

describe("customer-scoped order list", () => {
  let database: TestMongoDatabase;
  let client: Mongoose;
  const owner = new Types.ObjectId();
  const other = new Types.ObjectId();
  const codes = ["SK-1111-1111-1111-1111", "SK-2222-2222-2222-2222", "SK-3333-3333-3333-3333"];

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-customer-order-list-test");
    client = new Mongoose();
    await client.connect(database.uri);
    await getOrderModel(client.connection).syncIndexes();
    await client.connection.collection("orders").insertMany([
      {
        customerId: owner,
        code: codes[0],
        status: "pending_payment",
        createdAt: new Date("2026-10-01T10:00:00Z"),
        pricing: { totalCents: 1200 },
        fulfillment: { method: "pickup" },
        items: [{ name: "Kebab", quantity: 2 }],
      },
      {
        customerId: owner,
        code: codes[1],
        status: "completed",
        createdAt: new Date("2026-10-02T10:00:00Z"),
        pricing: { totalCents: 3500 },
        fulfillment: { method: "delivery" },
        items: [{ name: "Rice", quantity: 1 }],
      },
      {
        customerId: owner,
        code: codes[2],
        status: "cancelled",
        createdAt: new Date("2026-10-03T10:00:00Z"),
        pricing: { totalCents: 900 },
        fulfillment: { method: "pickup" },
        items: [{ name: "Soup", quantity: 1 }],
      },
      {
        customerId: other,
        code: "SK-AAAA-AAAA-AAAA-AAAA",
        status: "completed",
        createdAt: new Date("2026-10-04T10:00:00Z"),
        pricing: { totalCents: 99900 },
        fulfillment: { method: "delivery" },
        items: [{ name: "Private dish", quantity: 5 }],
      },
    ]);
  }, 120_000);

  afterAll(async () => {
    await client?.disconnect();
    await database?.stop();
  });

  it("returns bounded stable pages, counts, immutable summaries, and no other customer's orders", async () => {
    const first = await listCustomerOrders(client.connection, {
      customerId: owner.toString(),
      tab: "all",
      page: 1,
      pageSize: 2,
    });
    expect(first).toMatchObject({
      total: 3,
      totalPages: 2,
      counts: { all: 3, active: 1, completed: 1, closed: 1 },
    });
    expect(first.items.map(({ code }) => code)).toEqual([codes[2], codes[1]]);
    expect(first.items[1]).toMatchObject({
      totalCents: 3500,
      itemCount: 1,
      fulfillmentMethod: "delivery",
      items: [{ name: "Rice", quantity: 1 }],
    });
    expect(JSON.stringify(first)).not.toContain("Private dish");
    const second = await listCustomerOrders(client.connection, {
      customerId: owner.toString(),
      tab: "all",
      page: 2,
      pageSize: 2,
    });
    expect(second.items.map(({ code }) => code)).toEqual([codes[0]]);
  });

  it("filters statuses only inside the owner scope", async () => {
    const completed = await listCustomerOrders(client.connection, {
      customerId: owner.toString(),
      tab: "completed",
      page: 1,
      pageSize: 8,
    });
    expect(completed.items.map(({ code }) => code)).toEqual([codes[1]]);
    const incompatible = await listCustomerOrders(client.connection, {
      customerId: owner.toString(),
      tab: "active",
      status: "completed",
      page: 1,
      pageSize: 8,
    });
    expect(incompatible.items).toHaveLength(0);
    expect(customerOrderStatusFilter("active", "completed")).toEqual({ $in: [] });
  });

  it("resolves details only when both code and customer match", async () => {
    await expect(
      getCustomerOrderSummaryByCode(client.connection, owner.toString(), codes[1]!),
    ).resolves.toMatchObject({ code: codes[1], totalCents: 3500 });
    await expect(
      getCustomerOrderSummaryByCode(client.connection, other.toString(), codes[1]!),
    ).resolves.toBeNull();
    await expect(
      getCustomerOrderSummaryByCode(client.connection, owner.toString(), "SK-AAAA-AAAA-AAAA-AAAA"),
    ).resolves.toBeNull();
    await expect(
      getCustomerOrderSummaryByCode(client.connection, owner.toString(), "bad"),
    ).resolves.toBeNull();
  });
});
