import "server-only";

import type { NextRequest } from "next/server";
import type { Connection } from "mongoose";

import type { AdminPermission } from "@/constants/admin-access";
import { ApiError } from "@/server/http";
import {
  AddressCrudError,
  AddressRepositoryConflictError,
  createAddressAuditSink,
  createAddressCrudServices,
  createAddressRepository,
} from "@/server/modules/addresses";
import { getActiveCustomerIdentity } from "@/server/modules/customers";

import { customerAdminRequestContext, customerSelfRequestContext } from "../customers/route-helper";

export { customerSelfRequestContext as addressSelfRequestContext };

export function addressAdminRequestContext(
  request: NextRequest,
  permission: AdminPermission = "addresses:read-sensitive",
) {
  return customerAdminRequestContext(request, permission);
}

export function resolveAddressCrudServices(
  connection: Connection,
  requestId: string,
  userAgent?: string | null,
) {
  return createAddressCrudServices({
    repository: createAddressRepository(connection),
    customerExists: async (customerId) =>
      (await getActiveCustomerIdentity(connection, customerId)) !== null,
    audit: createAddressAuditSink(connection, {
      requestId,
      ...(userAgent !== undefined ? { userAgent } : {}),
    }),
  });
}

export function translateAddressCrudError(error: unknown): never {
  if (error instanceof AddressCrudError) {
    if (error.code === "forbidden") throw ApiError.authorization();
    if (error.code === "not_found") throw ApiError.notFound("address");
    if (error.code === "conflict") throw ApiError.conflict({ resource: "address" });
    throw ApiError.validation([
      { code: error.code, message: "The address data is not accepted.", path: [] },
    ]);
  }
  if (error instanceof AddressRepositoryConflictError)
    throw ApiError.conflict({ resource: "address" });
  throw error;
}
