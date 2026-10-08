import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createContactFlow,
  type ContactFlowError,
  type ContactFlowDependencies,
  type ContactSubmissionInput,
  type ContactSubmissionRepository,
  type ContactSubmissionSnapshot,
} from "@/server/modules/contacts";

const NOW = new Date("2026-10-08T12:00:00.000Z");
const ADMIN_ID = "507f1f77bcf86cd799439011";
const CONTACT_ID = "507f1f77bcf86cd799439012";

const input: ContactSubmissionInput = {
  fullName: "Sara Kazemi",
  mobile: "+351912345678",
  email: "sara@example.com",
  message: "I would like to ask about catering for an event.",
  locale: "en",
  sourceChannel: "website",
  privacyAccepted: true,
  privacyPolicyVersion: "privacy-2026-01",
  marketingAccepted: false,
  company: "",
};

function makeSnapshot(
  overrides: Partial<ContactSubmissionSnapshot> = {},
): ContactSubmissionSnapshot {
  return {
    id: CONTACT_ID,
    fullName: input.fullName,
    mobile: input.mobile,
    email: input.email,
    message: input.message,
    locale: "en",
    status: "new",
    assigneeAdminId: null,
    internalNotes: [],
    source: {
      channel: "website",
      pagePath: "/contact",
      referrerHost: "example.test",
      campaign: null,
      requestId: "req_contact_test",
      fingerprintHash: "f".repeat(64),
    },
    consent: {
      privacyAccepted: true,
      privacyPolicyVersion: "privacy-2026-01",
      acceptedAt: NOW.toISOString(),
      marketingAccepted: false,
    },
    spam: {
      disposition: "clean",
      score: 0,
      signals: [],
      provider: "local",
      checkedAt: NOW.toISOString(),
      honeypotMatched: false,
    },
    retentionExpiresAt: "2028-10-07T12:00:00.000Z",
    version: 0,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function harness(options: { duplicates?: number; notificationFails?: boolean } = {}) {
  let stored: ContactSubmissionSnapshot | null = null;
  const repository: ContactSubmissionRepository = {
    create: vi.fn(async (value) => {
      stored = makeSnapshot({
        source: value.source,
        consent: { ...value.consent, acceptedAt: value.consent.acceptedAt.toISOString() },
        spam: { ...value.spam, checkedAt: value.spam.checkedAt?.toISOString() ?? null },
      });
      return stored;
    }),
    countRecentByFingerprint: vi.fn(async () => options.duplicates ?? 0),
    list: vi.fn(async () => ({ items: stored ? [stored] : [], total: stored ? 1 : 0 })),
    findById: vi.fn(async () => stored),
    updateWorkflow: vi.fn(async (current, update) => {
      stored = makeSnapshot({
        ...current,
        status: update.status ?? current.status,
        assigneeAdminId:
          update.assigneeAdminId === undefined ? current.assigneeAdminId : update.assigneeAdminId,
      });
      return stored;
    }),
    archive: vi.fn(async (current) => {
      stored = makeSnapshot({ ...current, status: "archived" });
      return stored;
    }),
    delete: vi.fn(async () => {
      stored = null;
      return true;
    }),
  };
  const notify = vi.fn(async () => {
    if (options.notificationFails) throw new Error("provider unavailable");
  });
  const notificationFailed = vi.fn();
  const audit = vi.fn(async () => undefined);
  const dependencies: ContactFlowDependencies = {
    repository,
    fingerprint: () => "f".repeat(64),
    assigneeExists: async () => true,
    notify,
    notificationFailed,
    audit,
    now: () => NOW,
  };
  return {
    flow: createContactFlow(dependencies),
    repository,
    notify,
    notificationFailed,
    audit,
    stored: () => stored,
  };
}

describe("contact submission flow", () => {
  it("keeps the durable submission when notification delivery fails", async () => {
    const test = harness({ notificationFails: true });
    const result = await test.flow.createPublic(input, {
      pagePath: "/contact",
      referrerHost: "example.test",
      campaign: null,
      requestId: "req_contact_test",
    });

    expect(result).toMatchObject({ accepted: true, notificationDelivered: false });
    expect(test.stored()?.id).toBe(CONTACT_ID);
    expect(test.notificationFailed).toHaveBeenCalledWith(expect.any(Error), CONTACT_ID);
    expect(test.audit).toHaveBeenCalledWith(expect.objectContaining({ outcome: "success" }));
  });

  it("persists suspected duplicate spam without notifying staff", async () => {
    const test = harness({ duplicates: 1 });
    await test.flow.createPublic(input, {
      pagePath: "/contact",
      referrerHost: null,
      campaign: null,
      requestId: "req_contact_test",
    });

    expect(test.stored()?.spam).toMatchObject({ disposition: "suspected", score: 60 });
    expect(test.notify).not.toHaveBeenCalled();
  });

  it("rejects readers without permission and never returns the anti-spam fingerprint", async () => {
    const test = harness();
    await test.flow.createPublic(input, {
      pagePath: null,
      referrerHost: null,
      campaign: null,
      requestId: "req_contact_test",
    });
    await expect(test.flow.get({ id: ADMIN_ID, role: "viewer" }, CONTACT_ID)).rejects.toMatchObject(
      {
        code: "forbidden",
      },
    );
    const result = await test.flow.get({ id: ADMIN_ID, role: "order_operator" }, CONTACT_ID);
    expect(result.source).not.toHaveProperty("fingerprintHash");
  });

  it("enforces update and retention permissions", async () => {
    const test = harness();
    await test.flow.createPublic(input, {
      pagePath: null,
      referrerHost: null,
      campaign: null,
      requestId: "req_contact_test",
    });

    await expect(
      test.flow.update({ id: ADMIN_ID, role: "viewer" }, CONTACT_ID, { status: "resolved" }),
    ).rejects.toMatchObject({ code: "forbidden" } satisfies Partial<ContactFlowError>);
    await expect(
      test.flow.remove({ id: ADMIN_ID, role: "manager" }, CONTACT_ID),
    ).rejects.toMatchObject({ code: "retention_locked" } satisfies Partial<ContactFlowError>);
    await test.flow.archive({ id: ADMIN_ID, role: "manager" }, CONTACT_ID);
    await expect(test.flow.remove({ id: ADMIN_ID, role: "manager" }, CONTACT_ID)).resolves.toEqual({
      deleted: true,
    });
  });
});
