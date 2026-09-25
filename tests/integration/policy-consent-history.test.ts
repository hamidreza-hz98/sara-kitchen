import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createStoredRichText } from "@/lib/rich-text";
import {
  POLICY_CONSENT_APPEND_ONLY_ERROR,
  createPolicyVersionDraft,
  getPolicyConsentModel,
  getPolicyConsentTrace,
  getPolicyVersionModel,
  recordPolicyConsent,
  releasePolicyVersion,
  type PolicyVersionContent,
} from "@/server/modules/settings";

import { startTestMongoReplicaSet, type TestMongoDatabase } from "../helpers/mongodb";

function policyContent(version: number, effectiveAt: Date, title: string): PolicyVersionContent {
  return {
    documentType: "terms-of-service",
    version,
    effectiveAt,
    sectionIds: ["orders"],
    translations: [
      {
        locale: "en",
        title,
        summary: `Version ${version} terms.`,
        sections: [
          {
            id: "orders",
            title: "Orders",
            content: createStoredRichText({
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: `Order rules for version ${version}.` }],
                },
              ],
            }),
          },
        ],
      },
    ],
  };
}

describe("policy consent history", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoReplicaSet("sara-kitchen-policy-consent-test");
    client = new Mongoose();
    await client.connect(database.uri);
    await Promise.all([
      getPolicyVersionModel(client.connection).init(),
      getPolicyConsentModel(client.connection).init(),
    ]);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("traces old account and order consent to an immutable retired policy version", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const now = new Date("2026-09-25T10:00:00.000Z");
    const adminId = new Types.ObjectId().toHexString();
    const customerId = new Types.ObjectId().toHexString();
    const orderId = new Types.ObjectId().toHexString();

    const versionOneDraft = await createPolicyVersionDraft(
      client.connection,
      policyContent(1, new Date("2026-09-01T00:00:00.000Z"), "Terms v1"),
      adminId,
    );
    const versionOne = await releasePolicyVersion(
      client.connection,
      versionOneDraft._id.toHexString(),
      now,
    );
    expect(versionOne).toMatchObject({ state: "published", version: 1 });
    expect(versionOne.contentDigest).toMatch(/^[a-f\d]{64}$/u);

    const accountConsent = await recordPolicyConsent(client.connection, {
      subjectKind: "account",
      subjectId: customerId,
      customerId,
      policyVersionId: versionOneDraft._id.toHexString(),
      acceptedLocale: "en",
      acceptedAt: new Date("2026-09-25T10:05:00.000Z"),
      source: "signup",
      requestId: "signup-request-1",
    });
    const orderConsent = await recordPolicyConsent(client.connection, {
      subjectKind: "order",
      subjectId: orderId,
      customerId,
      policyVersionId: versionOneDraft._id.toHexString(),
      acceptedLocale: "en",
      acceptedAt: new Date("2026-09-25T10:10:00.000Z"),
      source: "checkout",
      requestId: "checkout-request-1",
    });
    expect(orderConsent.policySnapshot.contentDigest).toBe(
      accountConsent.policySnapshot.contentDigest,
    );

    const versionTwoDraft = await createPolicyVersionDraft(
      client.connection,
      policyContent(2, new Date("2026-09-25T00:00:00.000Z"), "Terms v2"),
      adminId,
    );
    await releasePolicyVersion(client.connection, versionTwoDraft._id.toHexString(), now);
    const storedVersionOne = await getPolicyVersionModel(client.connection)
      .findById(versionOneDraft._id)
      .exec();
    expect(storedVersionOne?.state).toBe("retired");
    expect(storedVersionOne?.retiredAt).toEqual(now);

    const accountTrace = await getPolicyConsentTrace(client.connection, "account", customerId);
    const orderTrace = await getPolicyConsentTrace(client.connection, "order", orderId);
    expect(accountTrace).toEqual([
      expect.objectContaining({
        integrity: "matched",
        snapshot: expect.objectContaining({ version: 1, contentDigest: versionOne.contentDigest }),
        policy: expect.objectContaining({ version: 1, id: versionOneDraft._id.toHexString() }),
      }),
    ]);
    expect(orderTrace[0]).toMatchObject({
      integrity: "matched",
      snapshot: { documentType: "terms-of-service", version: 1 },
      policy: { version: 1 },
    });

    const scheduledDraft = await createPolicyVersionDraft(
      client.connection,
      policyContent(3, new Date("2026-10-01T00:00:00.000Z"), "Terms v3"),
      adminId,
    );
    const scheduled = await releasePolicyVersion(
      client.connection,
      scheduledDraft._id.toHexString(),
      now,
    );
    expect(scheduled.state).toBe("scheduled");
    expect(
      await getPolicyVersionModel(client.connection).findOne({ version: 2 }).lean().exec(),
    ).toMatchObject({ state: "published" });

    if (!storedVersionOne) throw new Error("Historical policy disappeared.");
    storedVersionOne.set("translations", [
      { ...storedVersionOne.translations[0], title: "Tampered historical terms" },
    ]);
    await expect(storedVersionOne.save()).rejects.toThrow(/immutable/u);
    await expect(
      getPolicyConsentModel(client.connection).updateOne(
        { _id: accountConsent._id },
        { $set: { acceptedLocale: "fa" } },
      ),
    ).rejects.toThrow(POLICY_CONSENT_APPEND_ONLY_ERROR);
  });
});
