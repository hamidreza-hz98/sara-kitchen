import { Mongoose } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getOrderNotificationModel } from "@/server/modules/orders/model/order-notification";
import { getOrderModel } from "@/server/modules/orders/model/order";
import {
  dispatchOrderNotifications,
  listCustomerOrderNotifications,
} from "@/server/modules/orders/service/notification-dispatch";
import { queueOrderNotifications } from "@/server/modules/orders/service/notification-outbox";
import { renderOrderNotification } from "@/server/modules/orders/service/notification-templates";

import { startTestMongoReplicaSet, type TestMongoDatabase } from "../helpers/mongodb";
import { validOrder } from "../helpers/order";

describe("order notification outbox", () => {
  let database: TestMongoDatabase;
  let client: Mongoose;

  beforeAll(async () => {
    database = await startTestMongoReplicaSet("sara-kitchen-order-notifications-test");
    client = new Mongoose();
    await client.connect(database.uri);
    await getOrderModel(client.connection).syncIndexes();
    await getOrderNotificationModel(client.connection).syncIndexes();
  }, 120_000);

  afterAll(async () => {
    await client?.disconnect();
    await database?.stop();
  });

  beforeEach(async () => {
    await client.connection.collection("order_notifications").deleteMany({});
    await client.connection.collection("orders").deleteMany({});
  });

  it("renders all customer templates in all launch locales and English employer templates", () => {
    for (const locale of ["en", "pt-PT", "fa"] as const) {
      const rendered = renderOrderNotification("customer.order_confirmed", locale, "SK-1234");
      expect(rendered.body).toContain("SK-1234");
      expect(rendered.locale).toBe(locale);
    }
    expect(renderOrderNotification("employer.order_submitted", "fa", "SK-1234").locale).toBe("en");
  });

  it("commits customer inbox and unique employer work atomically", async () => {
    const order = await getOrderModel(client.connection).create(validOrder());
    await client.connection.transaction(async (session) => {
      await queueOrderNotifications(
        client.connection,
        order,
        "event:one",
        ["customer.order_confirmed", "employer.order_paid"],
        session,
      );
      await queueOrderNotifications(
        client.connection,
        order,
        "event:one",
        ["customer.order_confirmed", "employer.order_paid"],
        session,
      );
    });
    const records = await getOrderNotificationModel(client.connection).find().sort({ channel: 1 });
    expect(records).toHaveLength(2);
    expect(records.find((record) => record.channel === "in_app")?.state).toBe("delivered");
    expect(records.find((record) => record.channel === "whatsapp")?.state).toBe("pending");
    expect(
      await listCustomerOrderNotifications(client.connection, order.customerId.toString()),
    ).toHaveLength(1);
    expect(
      await listCustomerOrderNotifications(client.connection, "000000000000000000000000"),
    ).toHaveLength(0);
    await expect(
      client.connection.transaction(async (session) => {
        await queueOrderNotifications(
          client.connection,
          order,
          "event:rollback",
          ["employer.order_paid"],
          session,
        );
        throw new Error("order write failed");
      }),
    ).rejects.toThrow();
    expect(await getOrderNotificationModel(client.connection).countDocuments()).toBe(2);
  });

  it("retries failures, preserves one idempotency key, and exposes dead work", async () => {
    const order = await getOrderModel(client.connection).create(validOrder());
    await client.connection.transaction((session) =>
      queueOrderNotifications(
        client.connection,
        order,
        "event:retry",
        ["employer.order_submitted"],
        session,
      ),
    );
    let clock = new Date(Date.now() + 1000);
    const keys: string[] = [];
    const failedTransport = {
      send: async (input: { idempotencyKey: string }) => {
        keys.push(input.idempotencyKey);
        throw new Error("secret transport details");
      },
    };
    for (let attempt = 0; attempt < 5; attempt++) {
      const result = await dispatchOrderNotifications(client.connection, failedTransport, {
        now: () => clock,
        limit: 1,
      });
      expect(result.failed).toBe(1);
      clock = new Date(clock.getTime() + 10 * 60_000);
    }
    expect(new Set(keys).size).toBe(1);
    const record = await getOrderNotificationModel(client.connection).findOne();
    expect(record?.state).toBe("dead");
    expect(record?.attempts).toBe(5);
    expect(record?.lastErrorCode).toBe("delivery_failed");
    expect(JSON.stringify(record)).not.toContain("secret transport details");
  });

  it("marks a successful provider acknowledgement delivered only once", async () => {
    const order = await getOrderModel(client.connection).create(validOrder());
    await client.connection.transaction((session) =>
      queueOrderNotifications(
        client.connection,
        order,
        "event:success",
        ["employer.order_paid"],
        session,
      ),
    );
    let calls = 0;
    const transport = {
      send: async ({ idempotencyKey }: { idempotencyKey: string }) => {
        calls++;
        expect(idempotencyKey).toBe("event:success:employer.order_paid");
        return { messageId: "approved_message_1" };
      },
    };
    expect((await dispatchOrderNotifications(client.connection, transport)).delivered).toBe(1);
    expect((await dispatchOrderNotifications(client.connection, transport)).delivered).toBe(0);
    expect(calls).toBe(1);
    const record = await getOrderNotificationModel(client.connection).findOne();
    expect(record?.providerMessageId).toBe("approved_message_1");
    expect(record?.state).toBe("delivered");
  });
});
