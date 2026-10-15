import "server-only";

import type { NextRequest } from "next/server";

import type { AdminPermission } from "@/constants/admin-access";
import { LOCALE_COOKIE_NAME, resolveLocalePreference } from "@/locales/routing";
import { connectToDatabase } from "@/server/database";
import { getServerEnvironment } from "@/server/environment";
import { ApiError, getRequestValidationOptions } from "@/server/http";
import {
  AuthorizationGuardError,
  adminCookieName,
  isProtectedMutation,
  requireAdminActor,
} from "@/server/modules/auth";
import { OrderPaymentSyncError } from "@/server/modules/orders";
import {
  getLocalMbWaySandboxProvider,
  MbWaySandboxError,
  PaymentProviderError,
  TransactionManagementError,
  TransactionTransitionError,
} from "@/server/modules/transactions";

export async function transactionRequestContext(
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

export function localPaymentProvider() {
  const env = getServerEnvironment();
  if (process.env.NODE_ENV === "production" || !env.MBWAY_ENABLED || !env.MBWAY_WEBHOOK_SECRET)
    throw ApiError.serviceUnavailable("Payment actions require an approved provider.");
  return getLocalMbWaySandboxProvider(env.MBWAY_WEBHOOK_SECRET);
}

export function transactionActionKey(request: NextRequest): string {
  const key = request.headers.get("idempotency-key") ?? "";
  if (!/^[A-Za-z0-9._:-]{8,128}$/u.test(key))
    throw ApiError.validation([
      {
        code: "invalid_idempotency_key",
        message: "Supply a stable Idempotency-Key header.",
        path: ["idempotencyKey"],
      },
    ]);
  return key;
}

export function translateTransactionError(error: unknown): never {
  if (error instanceof TransactionManagementError) {
    if (error.code === "forbidden") throw ApiError.authorization();
    if (error.code === "not_found") throw ApiError.notFound("transaction");
    if (error.code === "unsupported")
      throw ApiError.conflict({
        resource: "payment",
        publicMessage:
          "This payment provider does not support automated refunds or cancellation. Follow the manual support process.",
      });
    throw ApiError.conflict({ resource: "transaction" });
  }
  if (error instanceof OrderPaymentSyncError || error instanceof TransactionTransitionError)
    throw ApiError.conflict({ resource: "transaction" });
  if (error instanceof PaymentProviderError) {
    if (error.code === "not-found") throw ApiError.notFound("provider_payment");
    if (error.code === "unsupported" || error.code === "conflict")
      throw ApiError.conflict({ resource: "payment" });
    throw ApiError.validation([
      { code: "provider_rejected", message: "Provider rejected the payment action.", path: [] },
    ]);
  }
  if (error instanceof MbWaySandboxError)
    throw ApiError.serviceUnavailable("Provider result is uncertain. Reconcile before retrying.");
  if (error instanceof Error && error.name === "VersionError")
    throw ApiError.conflict({ resource: "transaction" });
  throw error;
}
