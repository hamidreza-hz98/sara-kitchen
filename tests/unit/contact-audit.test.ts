import { Mongoose, type Connection } from "mongoose";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/modules/logs/repository/audit-log-repository", () => ({
  insertAuditLog: async (connection: Connection, input: unknown) => {
    const { getAuditLogModel } = await import("@/server/modules/logs/model/audit-log");
    const document = new (getAuditLogModel(connection))(input);
    await document.validate();
    return { id: document._id.toString(), occurredAt: document.occurredAt };
  },
}));

import { createContactAuditSink } from "@/server/modules/contacts/service/contact-audit";
import { createContactFlow } from "@/server/modules/contacts/service/contact-flow";
import type {
  ContactSubmissionRepository,
  ContactSubmissionSnapshot,
} from "@/server/modules/contacts/repository/contact-submission";

describe("contact audit integration", () => {
  it("lists empty and populated inboxes while validating the audit event", async () => {
    const connection = new Mongoose().connection;
    const item = {
      id: "507f1f77bcf86cd799439012",
      source: { fingerprintHash: "private", channel: "website" },
      mobile: null,
      email: null,
      message: "Hello",
      internalNotes: [],
      consent: null,
    } as unknown as ContactSubmissionSnapshot;
    const list = vi
      .fn()
      .mockResolvedValueOnce({ items: [], total: 0 })
      .mockResolvedValueOnce({ items: [item], total: 1 });
    const repository = { list } as unknown as ContactSubmissionRepository;
    const flow = createContactFlow({
      repository,
      audit: createContactAuditSink(connection, { requestId: "contact-test" }),
      fingerprint: () => "",
      assigneeExists: async () => false,
      notify: async () => {},
      notificationFailed: () => {},
      now: () => new Date(),
    });
    const actor = { id: "507f1f77bcf86cd799439011", role: "owner" as const };
    const options = { page: 1, pageSize: 20, sortDirection: "desc" as const };
    await expect(flow.list(actor, options)).resolves.toMatchObject({ items: [], total: 0 });
    await expect(flow.list(actor, options)).resolves.toMatchObject({
      items: [{ id: item.id }],
      total: 1,
    });
  });

  it("validates audit events for public submissions too", async () => {
    const sink = createContactAuditSink(new Mongoose().connection, { requestId: "contact-test" });
    await expect(
      sink({
        action: "create",
        actor: { kind: "anonymous", id: null },
        contactId: "507f1f77bcf86cd799439012",
        outcome: "success",
      }),
    ).resolves.toBeUndefined();
  });
});
