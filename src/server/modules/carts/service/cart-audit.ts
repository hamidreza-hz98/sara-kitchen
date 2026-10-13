import "server-only";

import type { Connection } from "mongoose";

import { recordAuditEvent } from "@/server/modules/logs";

import type { CartCrudAuditEvent } from "./cart-crud";
import type { CartMergeAuditEvent } from "./cart-merge";

const ACTION_CODES = {
  get: "security.access.check",
  create: "crud.resource.create",
  add_item: "crud.resource.update",
  update_quantity: "crud.resource.update",
  remove_item: "crud.resource.update",
  clear: "crud.resource.update",
  set_notes: "crud.resource.update",
  select_address: "crud.resource.update",
  recalculate: "crud.resource.update",
  expire: "crud.resource.delete",
} as const;

/** Canonical audit adapter. Guest bearer digests are deliberately absent from its input and output. */
export function createCartAuditSink(
  connection: Connection,
  context: Readonly<{ requestId: string; userAgent?: string | null }>,
) {
  return async (event: CartCrudAuditEvent): Promise<void> => {
    await recordAuditEvent(connection, {
      action: ACTION_CODES[event.action],
      actor: {
        kind: event.identityKind === "customer" ? "customer" : "anonymous",
        ref: event.actorRef,
        snapshot: { displayName: null, role: null },
      },
      resource: {
        kind: "cart",
        ref: event.cartId,
        snapshot: { code: null, label: null, status: "active" },
      },
      outcome: event.outcome === "conflict" ? "failure" : event.outcome,
      requestId: context.requestId,
      context: { cartAction: event.action, optimisticConflict: event.outcome === "conflict" },
      network: { policy: "omitted", ipHash: null, ipAddress: null },
      userAgent: context.userAgent ?? null,
    });
  };
}

/** Login-merge audit adapter; the guest bearer digest is never part of the event contract. */
export function createCartMergeAuditSink(
  connection: Connection,
  context: Readonly<{ requestId: string; userAgent?: string | null }>,
) {
  return async (event: CartMergeAuditEvent): Promise<void> => {
    await recordAuditEvent(connection, {
      action: "crud.resource.update",
      actor: {
        kind: "customer",
        ref: event.customerId,
        snapshot: { displayName: null, role: null },
      },
      resource: {
        kind: "cart",
        ref: event.cartId,
        snapshot: { code: null, label: null, status: "active" },
      },
      outcome: event.outcome === "conflict" ? "failure" : event.outcome,
      requestId: context.requestId,
      context: {
        cartAction: "merge_guest",
        idempotentReplay: event.idempotent,
        optimisticConflict: event.outcome === "conflict",
      },
      network: { policy: "omitted", ipHash: null, ipAddress: null },
      userAgent: context.userAgent ?? null,
    });
  };
}
