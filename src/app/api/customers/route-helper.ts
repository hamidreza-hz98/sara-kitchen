import "server-only";

import type { NextRequest } from "next/server";
import type { Connection } from "mongoose";

import type { AdminPermission } from "@/constants/admin-access";
import { LOCALE_COOKIE_NAME, resolveLocalePreference } from "@/locales/routing";
import { connectToDatabase } from "@/server/database";
import { ApiError, getRequestValidationOptions } from "@/server/http";
import {
  AuthorizationGuardError,
  adminCookieName,
  customerCookieName,
  isProtectedMutation,
  requireAdminActor,
  requireCustomerActor,
} from "@/server/modules/auth";
import {
  createCustomerAuditSink,
  createCustomerCrudServices,
  createCustomerRepository,
  CustomerCrudError,
  CustomerRepositoryConflictError,
} from "@/server/modules/customers";
import {
  countHistoricalOrdersForCustomer,
  exportOrderHistoryForCustomer,
} from "@/server/modules/orders";
import { revokeActorSessions } from "@/server/modules/sessions";

export async function customerAdminRequestContext(
  request: NextRequest,
  permission: AdminPermission,
  mutation = false,
) {
  const token = request.cookies.get(adminCookieName())?.value;
  if (!token) throw ApiError.authentication();
  if (mutation && !isProtectedMutation(request, "admin", token)) throw ApiError.authorization();
  const connection = await connectToDatabase();
  try {
    const actor = await requireAdminActor(connection, token, permission);
    const locale = resolveLocalePreference(request.cookies.get(LOCALE_COOKIE_NAME)?.value);
    return { connection, actor, validation: await getRequestValidationOptions(locale) };
  } catch (error) {
    if (error instanceof AuthorizationGuardError)
      throw error.reason === "unauthenticated"
        ? ApiError.authentication()
        : ApiError.authorization();
    throw error;
  }
}

export async function customerSelfRequestContext(request: NextRequest, mutation = false) {
  const token = request.cookies.get(customerCookieName())?.value;
  if (!token) throw ApiError.authentication();
  if (mutation && !isProtectedMutation(request, "customer", token)) throw ApiError.authorization();
  const connection = await connectToDatabase();
  try {
    const actor = await requireCustomerActor(connection, token);
    const locale = resolveLocalePreference(request.cookies.get(LOCALE_COOKIE_NAME)?.value);
    return { connection, actor, validation: await getRequestValidationOptions(locale) };
  } catch (error) {
    if (error instanceof AuthorizationGuardError) throw ApiError.authentication();
    throw error;
  }
}

export function resolveCustomerCrudServices(
  connection: Connection,
  requestId: string,
  userAgent?: string | null,
) {
  return createCustomerCrudServices({
    repository: createCustomerRepository(connection),
    audit: createCustomerAuditSink(connection, {
      requestId,
      ...(userAgent !== undefined ? { userAgent } : {}),
    }),
    revokeSessions: (customerId, reason) =>
      revokeActorSessions(connection, "customer", customerId, reason),
    countHistoricalOrders: (customerId) => countHistoricalOrdersForCustomer(connection, customerId),
    exportOrderHistory: (customerId) => exportOrderHistoryForCustomer(connection, customerId),
  });
}

export function translateCustomerCrudError(error: unknown): never {
  if (error instanceof CustomerCrudError) {
    if (error.code === "forbidden") throw ApiError.authorization();
    if (error.code === "not_found") throw ApiError.notFound("customer");
    if (error.code === "conflict") throw ApiError.conflict({ resource: "customer" });
    throw ApiError.validation([
      { code: error.code, message: "The customer data is not accepted.", path: [] },
    ]);
  }
  if (error instanceof CustomerRepositoryConflictError)
    throw ApiError.conflict({ resource: "customer" });
  throw error;
}
