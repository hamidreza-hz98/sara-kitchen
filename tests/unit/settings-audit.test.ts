import { describe, expect, it, vi } from "vitest";

const recordAuditEvent = vi.hoisted(() => vi.fn(async () => ({ id: "audit-1" })));

vi.mock("server-only", () => ({}));
vi.mock("@/server/modules/logs", () => ({ recordAuditEvent }));

import { createSettingsAuditSink } from "@/server/modules/settings/service/settings-audit";

describe("settings audit adapter", () => {
  it("records a bounded path-only diff without setting values", async () => {
    const sink = createSettingsAuditSink({} as never, {
      requestId: "settings-request-1",
      userAgent: "Vitest",
    });
    await sink({
      action: "update",
      actorId: "a".repeat(24),
      key: "languages",
      outcome: "success",
      publication: "published",
      summary: {
        changedPathCount: 2,
        changedPaths: ["data.defaultLocale", "translations.en"],
        fromRevision: 1,
        toRevision: 2,
        truncated: false,
      },
    });

    expect(recordAuditEvent).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        action: "settings.section.update",
        resource: expect.objectContaining({ kind: "settings-section", ref: "languages" }),
        context: expect.objectContaining({
          changedPaths: "data.defaultLocale|translations.en",
          changedPathCount: 2,
          fromRevision: 1,
          toRevision: 2,
        }),
      }),
    );
    expect(JSON.stringify(recordAuditEvent.mock.calls[0])).not.toContain("setting value");
  });
});
