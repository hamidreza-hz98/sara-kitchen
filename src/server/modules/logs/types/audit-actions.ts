import type { AuditOutcome, AuditSeverity, AuditType } from "./audit-event";

export type AuditActionDefinition = Readonly<{
  messages: Readonly<Record<AuditOutcome, string>>;
  severities: Readonly<Record<AuditOutcome, AuditSeverity>>;
  type: AuditType;
}>;

const DEFAULT_SEVERITIES = Object.freeze({
  denied: "warning",
  failure: "error",
  success: "info",
} as const satisfies Record<AuditOutcome, AuditSeverity>);

function defineAction(
  type: AuditType,
  messages: Readonly<Record<AuditOutcome, string>>,
  severities: Readonly<Record<AuditOutcome, AuditSeverity>> = DEFAULT_SEVERITIES,
): AuditActionDefinition {
  return Object.freeze({
    messages: Object.freeze({ ...messages }),
    severities: Object.freeze({ ...severities }),
    type,
  });
}

/**
 * Canonical English audit vocabulary. Domain modules select a code and outcome; they never compose
 * security-relevant prose from user input.
 */
export const AUDIT_ACTION_DEFINITIONS = Object.freeze({
  "auth.admin.login": defineAction("authentication", {
    denied: "Administrator sign-in was denied.",
    failure: "Administrator sign-in failed.",
    success: "Administrator signed in successfully.",
  }),
  "auth.customer.login": defineAction("authentication", {
    denied: "Customer sign-in was denied.",
    failure: "Customer sign-in failed.",
    success: "Customer signed in successfully.",
  }),
  "auth.customer.password-reset": defineAction("authentication", {
    denied: "Customer password reset was denied.",
    failure: "Customer password reset failed.",
    success: "Customer password was reset successfully.",
  }),
  "security.access.check": defineAction("authorization", {
    denied: "Access to the requested operation was denied.",
    failure: "Access evaluation failed.",
    success: "Access to the requested operation was granted.",
  }),
  "security.rate-limit.enforce": defineAction("security", {
    denied: "Rate-limit enforcement was denied.",
    failure: "Rate-limit enforcement failed.",
    success: "Rate limit was enforced successfully.",
  }),
  "crud.resource.create": defineAction("data", {
    denied: "Resource creation was denied.",
    failure: "Resource creation failed.",
    success: "Resource was created successfully.",
  }),
  "crud.resource.update": defineAction("data", {
    denied: "Resource update was denied.",
    failure: "Resource update failed.",
    success: "Resource was updated successfully.",
  }),
  "crud.resource.delete": defineAction("data", {
    denied: "Resource deletion was denied.",
    failure: "Resource deletion failed.",
    success: "Resource was deleted successfully.",
  }),
  "order.order.create": defineAction("business", {
    denied: "Order creation was denied.",
    failure: "Order creation failed.",
    success: "Order was created successfully.",
  }),
  "order.order.status-change": defineAction("business", {
    denied: "Order status change was denied.",
    failure: "Order status change failed.",
    success: "Order status was changed successfully.",
  }),
  "payment.transaction.process": defineAction("business", {
    denied: "Payment processing was denied.",
    failure: "Payment processing failed.",
    success: "Payment was processed successfully.",
  }),
  "settings.section.update": defineAction("data", {
    denied: "Settings update was denied.",
    failure: "Settings update failed.",
    success: "Settings were updated successfully.",
  }),
});

export type AuditActionCode = keyof typeof AUDIT_ACTION_DEFINITIONS;

export function isAuditActionCode(value: unknown): value is AuditActionCode {
  return typeof value === "string" && Object.hasOwn(AUDIT_ACTION_DEFINITIONS, value);
}

export function getAuditActionDefinition(action: AuditActionCode): AuditActionDefinition {
  return AUDIT_ACTION_DEFINITIONS[action];
}
