import { Mongoose, Types } from "mongoose";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  CONTACT_MESSAGE_MAX_LENGTH,
  CONTACT_MESSAGE_MIN_LENGTH,
  CONTACT_RETENTION_DAYS,
  contactRetentionExpiresAt,
  contactSubmissionInputSchema,
} from "@/server/modules/contacts";
import { getContactSubmissionModel } from "@/server/modules/contacts/model/contact-submission";

const valid = {
  fullName: "  Sara   Kazemi ",
  mobile: "912 345 678",
  email: " SARA@Example.COM ",
  message: "I would like to ask about catering for an event.",
  locale: "en",
  source: { channel: "website", pagePath: "/contact" },
  consent: {
    privacyAccepted: true,
    privacyPolicyVersion: "privacy-2026-01",
    acceptedAt: new Date("2026-10-08T00:00:00.000Z"),
    marketingAccepted: false,
  },
};

describe("contact submission model", () => {
  const client = new Mongoose();
  const ContactSubmission = getContactSubmissionModel(client.connection);

  it("normalizes optional identity data and defines safe workflow defaults", async () => {
    const submission = new ContactSubmission(valid);
    await expect(submission.validate()).resolves.toBeUndefined();
    expect(submission).toMatchObject({
      fullName: "Sara Kazemi",
      mobile: "+351912345678",
      email: "sara@example.com",
      status: "new",
      assigneeAdminId: null,
    });
    expect(submission.internalNotes).toEqual([]);
    expect(submission.spam).toMatchObject({
      disposition: "pending",
      score: 0,
      signals: [],
      honeypotMatched: false,
    });
  });

  it("requires one response channel, privacy consent, and bounded message content", async () => {
    const missingContact = new ContactSubmission({ ...valid, mobile: null, email: null });
    await expect(missingContact.validate()).rejects.toMatchObject({
      errors: expect.objectContaining({ mobile: expect.anything() }),
    });
    const missingConsent = new ContactSubmission({
      ...valid,
      consent: { ...valid.consent, privacyAccepted: false },
    });
    await expect(missingConsent.validate()).rejects.toMatchObject({
      errors: expect.objectContaining({ "consent.privacyAccepted": expect.anything() }),
    });
    for (const message of [
      "x".repeat(CONTACT_MESSAGE_MIN_LENGTH - 1),
      "x".repeat(CONTACT_MESSAGE_MAX_LENGTH + 1),
    ]) {
      await expect(new ContactSubmission({ ...valid, message }).validate()).rejects.toMatchObject({
        errors: expect.objectContaining({ message: expect.anything() }),
      });
    }
  });

  it("requires coherent, allow-listed spam evidence", async () => {
    const adminId = new Types.ObjectId();
    const reviewed = new ContactSubmission({
      ...valid,
      assigneeAdminId: adminId,
      spam: {
        disposition: "suspected",
        score: 80,
        signals: ["honeypot", "link_density"],
        provider: "local",
        checkedAt: new Date(),
        honeypotMatched: true,
      },
      internalNotes: [{ authorAdminId: adminId, body: "Review before replying." }],
    });
    await expect(reviewed.validate()).resolves.toBeUndefined();

    const contradictory = new ContactSubmission({
      ...valid,
      spam: { disposition: "blocked", score: 100, honeypotMatched: true, signals: [] },
    });
    await expect(contradictory.validate()).rejects.toMatchObject({
      errors: expect.objectContaining({
        spam: expect.anything(),
        "spam.signals": expect.anything(),
      }),
    });
  });

  it("normalizes public input and rejects populated honeypots", () => {
    const parsed = contactSubmissionInputSchema.parse({
      fullName: valid.fullName,
      mobile: valid.mobile,
      email: valid.email,
      message: valid.message,
      locale: "fa",
      privacyAccepted: true,
      privacyPolicyVersion: "privacy-2026-01",
    });
    expect(parsed).toMatchObject({
      fullName: "Sara Kazemi",
      mobile: "+351912345678",
      email: "sara@example.com",
      company: "",
    });
    expect(
      contactSubmissionInputSchema.safeParse({
        ...parsed,
        company: "bot company",
      }).success,
    ).toBe(false);
  });

  it("defines workflow, spam-review, search, and expiry indexes", () => {
    expect(ContactSubmission.schema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { status: 1, createdAt: -1, _id: -1 },
          expect.objectContaining({ name: "contact_status_created" }),
        ],
        [
          { retentionExpiresAt: 1 },
          expect.objectContaining({ name: "contact_retention_ttl", expireAfterSeconds: 0 }),
        ],
      ]),
    );
    const start = new Date("2026-01-01T00:00:00.000Z");
    expect(contactRetentionExpiresAt("spam", start).toISOString()).toBe("2026-04-01T00:00:00.000Z");
    expect(CONTACT_RETENTION_DAYS.resolved).toBe(730);
    const retentionStart = Date.now();
    const spam = new ContactSubmission({
      ...valid,
      status: "spam",
      spam: {
        disposition: "blocked",
        score: 100,
        signals: ["provider_flag"],
        provider: "local",
        checkedAt: new Date(),
      },
    });
    const retentionDays = (spam.retentionExpiresAt.getTime() - retentionStart) / 86_400_000;
    expect(retentionDays).toBeGreaterThan(89.99);
    expect(retentionDays).toBeLessThan(90.01);
  });
});
