import "server-only";

import type { Connection } from "mongoose";

import { getCustomerModel } from "../model/customer";
import type { CustomerSignupInput } from "../validation/signup";
import { hashCustomerPassword } from "./password";

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11_000;
}

/** Returns a new ID only to auth orchestration; duplicate status is hidden at the route boundary. */
export async function registerCustomer(
  connection: Connection,
  input: CustomerSignupInput,
): Promise<string | null> {
  const now = new Date();
  const passwordHash = await hashCustomerPassword(input.password);
  try {
    const customer = await getCustomerModel(connection).create({
      firstName: input.firstName,
      lastName: input.lastName,
      mobile: input.mobile,
      email: input.email,
      passwordHash,
      termsAcceptedAt: now,
      marketingConsent: input.marketingConsent,
      marketingConsentAt: input.marketingConsent ? now : null,
      mobileVerifiedAt: null,
      emailVerifiedAt: null,
    });
    return customer._id.toHexString();
  } catch (error) {
    // Unique indexes, not an existence query, resolve concurrent registrations.
    if (!isDuplicateKey(error)) throw error;
    return null;
  }
}
