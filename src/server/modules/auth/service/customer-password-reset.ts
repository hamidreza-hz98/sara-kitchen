import "server-only";

import type { Connection } from "mongoose";

import {
  findCustomerForReset,
  hashCustomerPassword,
  isStrongSignupPassword,
  replaceCustomerPasswordAfterReset,
} from "@/server/modules/customers";
import { revokeActorSessions } from "@/server/modules/sessions";

import { getPasswordResetModel } from "../model/password-reset";
import { createPasswordResetToken, hashPasswordResetToken } from "./password-reset-token";
import type { ResetSmsSender } from "./reset-sms";

export const PASSWORD_RESET_LIFETIME_MS = 15 * 60 * 1_000;

export class PasswordResetRejectedError extends Error {
  constructor() {
    super("Invalid or expired password reset request.");
    this.name = "PasswordResetRejectedError";
  }
}

export async function requestCustomerPasswordReset(
  connection: Connection,
  input: { identifier: string; locale: string; siteUrl: string },
  sender: ResetSmsSender,
): Promise<void> {
  const customer = await findCustomerForReset(connection, input.identifier);
  if (!customer) return;
  const now = new Date();
  const Reset = getPasswordResetModel(connection);
  // Only the newest still-unconsumed token is usable for this customer.
  await Reset.updateMany(
    { customerId: customer.id, consumedAt: null },
    { $set: { consumedAt: now } },
  );
  const token = createPasswordResetToken();
  const tokenHash = hashPasswordResetToken(token);
  if (!tokenHash) throw new Error("Failed to generate a valid password reset token.");
  const record = await Reset.create({
    tokenHash,
    customerId: customer.id,
    passwordVersion: customer.passwordVersion,
    expiresAt: new Date(now.getTime() + PASSWORD_RESET_LIFETIME_MS),
  });
  const link = `${new URL("/reset-password", input.siteUrl).toString()}#token=${token}`;
  try {
    await sender(customer.mobile, link, input.locale);
  } catch {
    await Reset.updateOne(
      { _id: record._id, consumedAt: null },
      { $set: { consumedAt: new Date() } },
    );
    throw new Error("Password reset delivery failed.");
  }
}

export async function resetCustomerPassword(
  connection: Connection,
  token: string,
  newPassword: string,
): Promise<void> {
  if (!isStrongSignupPassword(newPassword)) throw new PasswordResetRejectedError();
  const tokenHash = hashPasswordResetToken(token);
  if (!tokenHash) throw new PasswordResetRejectedError();
  const passwordHash = await hashCustomerPassword(newPassword);
  const now = new Date();
  const record = await getPasswordResetModel(connection).findOneAndUpdate(
    { tokenHash, consumedAt: null, expiresAt: { $gt: now } },
    { $set: { consumedAt: now } },
    { returnDocument: "after" },
  );
  if (!record) throw new PasswordResetRejectedError();
  const updated = await replaceCustomerPasswordAfterReset(
    connection,
    record.customerId.toHexString(),
    record.passwordVersion,
    passwordHash,
  );
  if (!updated) throw new PasswordResetRejectedError();
  await revokeActorSessions(
    connection,
    "customer",
    record.customerId.toHexString(),
    "password-reset",
    now,
  );
}
