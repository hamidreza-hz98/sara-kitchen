import { Mongoose } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getContactSubmissionModel } from "@/server/modules/contacts/model/contact-submission";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

describe("contact submission persistence", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-contact-submission-test");
    client = new Mongoose();
    await client.connect(database.uri);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("persists normalized data and creates the retention TTL index", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const ContactSubmission = getContactSubmissionModel(client.connection);
    await ContactSubmission.init();
    const created = await ContactSubmission.create({
      fullName: "  سارا   کاظمی ",
      mobile: "۹۱۲ ۳۴۵ ۶۷۸",
      message: "Please call me about a catering order.",
      locale: "fa",
      consent: {
        privacyAccepted: true,
        privacyPolicyVersion: "privacy-2026-01",
        acceptedAt: new Date(),
      },
    });
    expect(created).toMatchObject({ fullName: "سارا کاظمی", mobile: "+351912345678" });
    const indexes = await ContactSubmission.collection.indexes();
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "contact_retention_ttl", expireAfterSeconds: 0 }),
      ]),
    );
  });
});
