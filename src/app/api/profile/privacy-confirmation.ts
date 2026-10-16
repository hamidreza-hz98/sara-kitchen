import "server-only";

import type { NextRequest } from "next/server";
import type { Connection } from "mongoose";

import { ApiError } from "@/server/http";
import { limitSensitiveAccountOperation } from "@/server/modules/auth";
import { verifyCustomerPasswordForLogin } from "@/server/modules/customers";

/** A fresh password check is required for every customer export or anonymization request. */
export async function confirmCustomerPrivacyPassword(
  connection: Connection,
  request: NextRequest,
  customerId: string,
  currentPassword: string,
): Promise<void> {
  await limitSensitiveAccountOperation(connection, request, {
    principal: "customer",
    actorId: customerId,
    operation: "privacy",
  });
  if (!(await verifyCustomerPasswordForLogin(connection, customerId, currentPassword)))
    throw ApiError.authorization();
}
