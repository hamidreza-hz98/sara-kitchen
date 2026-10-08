import "server-only";

import { hasAdminPermission, type AdminRole } from "@/constants/admin-access";

import type {
  CustomerListOptions,
  CustomerProfileWrite,
  CustomerRepository,
  CustomerSnapshot,
} from "../repository/customer";
import {
  isValidCustomerEmail,
  isValidCustomerMobile,
  isValidCustomerName,
  normalizeCustomerEmail,
  normalizeCustomerMobile,
  normalizeCustomerName,
} from "../validation/customer-identity";
import type { CustomerProfileUpdateInput } from "../validation/customer-request";

export type CustomerCrudActor =
  | Readonly<{ kind: "admin"; id: string; role: AdminRole }>
  | Readonly<{ kind: "customer"; id: string }>;
export type CustomerCrudAction = "list" | "read" | "update" | "status" | "export" | "anonymize";
export type CustomerCrudAuditEvent = Readonly<{
  action: CustomerCrudAction;
  actor: Readonly<{ kind: "admin" | "customer"; id: string }>;
  customerId: string | null;
  outcome: "success" | "failure" | "denied";
}>;
export type CustomerCrudDependencies = Readonly<{
  repository: CustomerRepository;
  audit(event: CustomerCrudAuditEvent): Promise<void>;
  revokeSessions(customerId: string, reason: "account-disabled" | "security"): Promise<number>;
  countHistoricalOrders(customerId: string): Promise<number>;
  exportOrderHistory(customerId: string): Promise<readonly Record<string, unknown>[]>;
}>;
export type CustomerView = Omit<CustomerSnapshot, "passwordVersion" | "mobile" | "email"> & {
  mobile: string | null;
  email: string | null;
};

export class CustomerCrudError extends Error {
  constructor(readonly code: "conflict" | "forbidden" | "invalid_input" | "not_found") {
    super(code);
    this.name = "CustomerCrudError";
  }
}

function adminCan(
  actor: CustomerCrudActor,
  permission:
    "customers:read" | "customers:read-sensitive" | "customers:update" | "customers:delete",
) {
  return (
    actor.kind === "admin" && hasAdminPermission({ role: actor.role, active: true }, permission)
  );
}

function requireAccess(actor: CustomerCrudActor, action: CustomerCrudAction, customerId?: string) {
  if (actor.kind === "customer") {
    if (!customerId || actor.id !== customerId || action === "list" || action === "status")
      throw new CustomerCrudError("forbidden");
    return;
  }
  const permission =
    action === "list" || action === "read" || action === "export"
      ? "customers:read"
      : action === "anonymize"
        ? "customers:delete"
        : "customers:update";
  if (!adminCan(actor, permission)) throw new CustomerCrudError("forbidden");
  if (action === "export" && !adminCan(actor, "customers:read-sensitive"))
    throw new CustomerCrudError("forbidden");
}

function toView(actor: CustomerCrudActor, customer: CustomerSnapshot): CustomerView {
  const sensitive =
    customer.status !== "anonymized" &&
    (actor.kind === "customer" || adminCan(actor, "customers:read-sensitive"));
  const safe = Object.fromEntries(
    Object.entries(customer).filter(([key]) => key !== "passwordVersion"),
  ) as Omit<CustomerSnapshot, "passwordVersion">;
  return {
    ...safe,
    mobile: sensitive ? customer.mobile : null,
    email: sensitive ? customer.email : null,
  };
}

function mergeProfile(
  current: CustomerSnapshot,
  input: CustomerProfileUpdateInput,
): CustomerProfileWrite {
  const firstName = normalizeCustomerName(input.firstName ?? current.firstName);
  const lastName = normalizeCustomerName(input.lastName ?? current.lastName);
  const mobile = normalizeCustomerMobile(input.mobile ?? current.mobile);
  const email = normalizeCustomerEmail(input.email === undefined ? current.email : input.email);
  if (
    !isValidCustomerName(firstName) ||
    !isValidCustomerName(lastName) ||
    !isValidCustomerMobile(mobile) ||
    !isValidCustomerEmail(email)
  )
    throw new CustomerCrudError("invalid_input");
  return {
    firstName,
    lastName,
    mobile,
    email,
    marketingConsent: input.marketingConsent ?? current.marketingConsent,
  };
}

async function execute<T>(
  deps: CustomerCrudDependencies,
  actor: CustomerCrudActor,
  action: CustomerCrudAction,
  customerId: string | null,
  work: () => Promise<T>,
): Promise<T> {
  try {
    requireAccess(actor, action, customerId ?? undefined);
    const result = await work();
    await deps.audit({
      action,
      actor: { kind: actor.kind, id: actor.id },
      customerId,
      outcome: "success",
    });
    return result;
  } catch (error) {
    await deps.audit({
      action,
      actor: { kind: actor.kind, id: actor.id },
      customerId,
      outcome:
        error instanceof CustomerCrudError && error.code === "forbidden" ? "denied" : "failure",
    });
    throw error;
  }
}

export function createCustomerCrudServices(deps: CustomerCrudDependencies) {
  const find = async (id: string, includeAnonymized = false) => {
    const customer = await deps.repository.findById(id, includeAnonymized);
    if (!customer) throw new CustomerCrudError("not_found");
    return customer;
  };
  return {
    async list(actor: CustomerCrudActor, options: CustomerListOptions) {
      return execute(deps, actor, "list", null, async () => {
        if (
          !Number.isSafeInteger(options.page) ||
          options.page < 1 ||
          !Number.isSafeInteger(options.pageSize) ||
          options.pageSize < 1 ||
          options.pageSize > 100 ||
          (options.search?.length ?? 0) > 80
        )
          throw new CustomerCrudError("invalid_input");
        const result = await deps.repository.list(options);
        return { ...result, items: result.items.map((item) => toView(actor, item)) };
      });
    },
    async get(actor: CustomerCrudActor, id: string) {
      return execute(deps, actor, "read", id, async () =>
        toView(actor, await find(id, actor.kind === "admin")),
      );
    },
    async update(actor: CustomerCrudActor, id: string, input: CustomerProfileUpdateInput) {
      return execute(deps, actor, "update", id, async () => {
        const current = await find(id);
        if (current.status === "anonymized") throw new CustomerCrudError("conflict");
        return toView(
          actor,
          await deps.repository.saveProfile(current, mergeProfile(current, input), {
            kind: actor.kind,
            id: actor.id,
          }),
        );
      });
    },
    async setStatus(actor: CustomerCrudActor, id: string, status: "active" | "disabled") {
      return execute(deps, actor, "status", id, async () => {
        const current = await find(id);
        if (current.status === "anonymized") throw new CustomerCrudError("conflict");
        const changed = current.status !== status;
        const saved = changed
          ? await deps.repository.setStatus(current, status, { kind: actor.kind, id: actor.id })
          : current;
        if (changed && status === "disabled") await deps.revokeSessions(id, "account-disabled");
        return toView(actor, saved);
      });
    },
    async exportAccount(actor: CustomerCrudActor, id: string) {
      return execute(deps, actor, "export", id, async () => ({
        exportedAt: new Date().toISOString(),
        profile: toView(actor, await find(id, actor.kind === "admin")),
        orders: await deps.exportOrderHistory(id),
      }));
    },
    async anonymize(actor: CustomerCrudActor, id: string) {
      return execute(deps, actor, "anonymize", id, async () => {
        const current = await find(id);
        const historicalOrders = await deps.countHistoricalOrders(id);
        const saved = await deps.repository.anonymize(
          current,
          { kind: actor.kind, id: actor.id },
          historicalOrders > 0 ? "historical_orders" : "privacy_request",
          new Date(),
        );
        await deps.revokeSessions(id, "security");
        return { customer: toView(actor, saved), historicalOrders, hardDeleted: false as const };
      });
    },
  };
}
