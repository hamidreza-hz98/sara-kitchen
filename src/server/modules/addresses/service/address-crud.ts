import "server-only";

import { hasAdminPermission, type AdminRole } from "@/constants/admin-access";

import type { AddressRepository, AddressSnapshot } from "../repository/address";
import {
  addressUpdateSchema,
  addressWriteSchema,
  type AddressUpdateInput,
  type AddressWriteInput,
} from "../validation/address";

export type AddressCrudActor =
  | Readonly<{ kind: "admin"; id: string; role: AdminRole }>
  | Readonly<{ kind: "customer"; id: string }>;
export type AddressCrudAction = "list" | "read" | "create" | "update" | "delete" | "set-default";
export type AddressCrudAuditEvent = Readonly<{
  action: AddressCrudAction;
  actor: Readonly<{ kind: "admin" | "customer"; id: string }>;
  customerId: string;
  addressId: string | null;
  outcome: "success" | "failure" | "denied";
}>;
export type AddressCrudDependencies = Readonly<{
  repository: AddressRepository;
  customerExists(customerId: string): Promise<boolean>;
  audit(event: AddressCrudAuditEvent): Promise<void>;
}>;

export class AddressCrudError extends Error {
  constructor(readonly code: "conflict" | "forbidden" | "invalid_input" | "not_found") {
    super(code);
    this.name = "AddressCrudError";
  }
}

function requireAccess(actor: AddressCrudActor, action: AddressCrudAction, customerId: string) {
  if (actor.kind === "customer") {
    if (actor.id !== customerId) throw new AddressCrudError("forbidden");
    return;
  }
  if (
    (action !== "list" && action !== "read") ||
    !hasAdminPermission({ role: actor.role, active: true }, "addresses:read-sensitive")
  )
    throw new AddressCrudError("forbidden");
}

async function execute<T>(
  deps: AddressCrudDependencies,
  actor: AddressCrudActor,
  action: AddressCrudAction,
  customerId: string,
  addressId: string | null,
  work: () => Promise<T>,
): Promise<T> {
  try {
    requireAccess(actor, action, customerId);
    const result = await work();
    await deps.audit({
      action,
      actor: { kind: actor.kind, id: actor.id },
      customerId,
      addressId,
      outcome: "success",
    });
    return result;
  } catch (error) {
    await deps.audit({
      action,
      actor: { kind: actor.kind, id: actor.id },
      customerId,
      addressId,
      outcome:
        error instanceof AddressCrudError && error.code === "forbidden" ? "denied" : "failure",
    });
    throw error;
  }
}

export function createAddressCrudServices(deps: AddressCrudDependencies) {
  const owned = async (customerId: string, addressId: string): Promise<AddressSnapshot> => {
    const address = await deps.repository.findOwnedById(customerId, addressId);
    if (!address) throw new AddressCrudError("not_found");
    return address;
  };
  return {
    list(actor: AddressCrudActor, customerId: string) {
      return execute(deps, actor, "list", customerId, null, () =>
        deps.repository.listForCustomer(customerId),
      );
    },
    get(actor: AddressCrudActor, customerId: string, addressId: string) {
      return execute(deps, actor, "read", customerId, addressId, () =>
        owned(customerId, addressId),
      );
    },
    create(actor: AddressCrudActor, customerId: string, input: AddressWriteInput) {
      return execute(deps, actor, "create", customerId, null, async () => {
        const parsed = addressWriteSchema.safeParse(input);
        if (!parsed.success) throw new AddressCrudError("invalid_input");
        if (!(await deps.customerExists(customerId))) throw new AddressCrudError("not_found");
        return deps.repository.create(customerId, parsed.data, actor.id);
      });
    },
    update(
      actor: AddressCrudActor,
      customerId: string,
      addressId: string,
      input: AddressUpdateInput,
    ) {
      return execute(deps, actor, "update", customerId, addressId, async () => {
        const parsed = addressUpdateSchema.safeParse(input);
        if (!parsed.success) throw new AddressCrudError("invalid_input");
        return deps.repository.save(await owned(customerId, addressId), parsed.data, actor.id);
      });
    },
    remove(actor: AddressCrudActor, customerId: string, addressId: string) {
      return execute(deps, actor, "delete", customerId, addressId, async () =>
        deps.repository.softDelete(await owned(customerId, addressId), actor.id, new Date()),
      );
    },
    setDefault(actor: AddressCrudActor, customerId: string, addressId: string) {
      return execute(deps, actor, "set-default", customerId, addressId, async () =>
        deps.repository.makeDefault(await owned(customerId, addressId), actor.id),
      );
    },
  };
}
