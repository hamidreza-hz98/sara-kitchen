import { describe, expect, it, vi } from "vitest";

const recordAuditEvent = vi.hoisted(() => vi.fn(async () => ({ id: "audit-cart-1" })));

vi.mock("server-only", () => ({}));
vi.mock("@/server/modules/logs", () => ({ recordAuditEvent }));

import { createCartAuditSink } from "@/server/modules/carts/service/cart-audit";

describe("cart audit adapter", () => {
  it("records customer mutation metadata without cart content", async () => {
    const sink = createCartAuditSink({} as never, {
      requestId: "cart-request-1",
      userAgent: "Vitest",
    });
    await sink({
      action: "add_item",
      actorRef: "a".repeat(24),
      cartId: "b".repeat(24),
      identityKind: "customer",
      outcome: "success",
    });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        action: "crud.resource.update",
        actor: expect.objectContaining({ kind: "customer", ref: "a".repeat(24) }),
        resource: expect.objectContaining({ kind: "cart", ref: "b".repeat(24) }),
        context: { cartAction: "add_item", optimisticConflict: false },
      }),
    );
  });

  it("never records the guest digest or treats a conflict as success", async () => {
    recordAuditEvent.mockClear();
    const sink = createCartAuditSink({} as never, { requestId: "cart-request-2" });
    await sink({
      action: "update_quantity",
      actorRef: null,
      cartId: "c".repeat(24),
      identityKind: "guest",
      outcome: "conflict",
    });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        actor: expect.objectContaining({ kind: "anonymous", ref: null }),
        outcome: "failure",
        context: { cartAction: "update_quantity", optimisticConflict: true },
      }),
    );
    expect(JSON.stringify(recordAuditEvent.mock.calls)).not.toContain("guestTokenHash");
  });
});
