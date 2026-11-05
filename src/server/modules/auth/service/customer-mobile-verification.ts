import "server-only";

import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { Connection } from "mongoose";

import { markCustomerMobileVerified } from "@/server/modules/customers";
import { getServerEnvironment } from "@/server/environment";

import { getMobileVerificationModel } from "../model/mobile-verification";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const CODE_PATTERN = /^\d{6}$/u;
export const CUSTOMER_MOBILE_VERIFICATION_LIFETIME_MS = 10 * 60 * 1_000;
const CHALLENGE_RETENTION_MS = 24 * 60 * 60 * 1_000;
const MAX_ATTEMPTS = 6;

export class CustomerMobileVerificationRejectedError extends Error {
  constructor() {
    super("Invalid or expired mobile verification code.");
    this.name = "CustomerMobileVerificationRejectedError";
  }
}

function hmac(value: string): string {
  return createHmac("sha256", getServerEnvironment().AUTH_SESSION_SECRET)
    .update(value, "utf8")
    .digest("hex");
}

function hashChallengeToken(token: string): string | null {
  if (
    !TOKEN_PATTERN.test(token) ||
    Buffer.from(token, "base64url").toString("base64url") !== token ||
    Buffer.from(token, "base64url").length !== 32
  )
    return null;
  return hmac(`mobile-verification-token:v1:${token}`);
}

function hashCode(token: string, code: string): string {
  return hmac(`mobile-verification-code:v1:${token}:${code}`);
}

export function mobileVerificationDevelopmentCodeEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    getServerEnvironment().CUSTOMER_MOBILE_VERIFICATION_DEVELOPMENT_CODE_ENABLED
  );
}

export async function createCustomerMobileVerification(
  connection: Connection,
  input: { customerId: string; mobile: string },
): Promise<{ challengeToken: string; developmentCode: string }> {
  const now = new Date();
  const challengeToken = randomBytes(32).toString("base64url");
  const developmentCode = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const challengeHash = hashChallengeToken(challengeToken);
  if (!challengeHash) throw new Error("Could not create a mobile verification challenge.");

  const Verifications = getMobileVerificationModel(connection);
  await Verifications.updateMany(
    { customerId: input.customerId, consumedAt: null },
    { $set: { consumedAt: now } },
  );
  await Verifications.create({
    challengeHash,
    codeHash: hashCode(challengeToken, developmentCode),
    customerId: input.customerId,
    mobile: input.mobile,
    expiresAt: new Date(now.getTime() + CUSTOMER_MOBILE_VERIFICATION_LIFETIME_MS),
    purgeAt: new Date(now.getTime() + CHALLENGE_RETENTION_MS),
  });
  return { challengeToken, developmentCode };
}

export async function resendCustomerMobileVerification(
  connection: Connection,
  challengeToken: string,
): Promise<{ challengeToken: string; developmentCode: string }> {
  const challengeHash = hashChallengeToken(challengeToken);
  if (!challengeHash) throw new CustomerMobileVerificationRejectedError();
  const previous = await getMobileVerificationModel(connection)
    .findOne({ challengeHash, consumedAt: null, purgeAt: { $gt: new Date() } })
    .select("customerId mobile")
    .exec();
  if (!previous) throw new CustomerMobileVerificationRejectedError();
  return createCustomerMobileVerification(connection, {
    customerId: previous.customerId.toHexString(),
    mobile: previous.mobile,
  });
}

export async function verifyCustomerMobile(
  connection: Connection,
  input: { challengeToken: string; code: string },
): Promise<string> {
  const challengeHash = hashChallengeToken(input.challengeToken);
  if (!challengeHash || !CODE_PATTERN.test(input.code)) {
    throw new CustomerMobileVerificationRejectedError();
  }

  const now = new Date();
  const Verifications = getMobileVerificationModel(connection);
  const verification = await Verifications.findOne({
    challengeHash,
    consumedAt: null,
    expiresAt: { $gt: now },
    attempts: { $lt: MAX_ATTEMPTS },
  })
    .select("+codeHash")
    .exec();
  if (!verification) throw new CustomerMobileVerificationRejectedError();

  const expectedHash = Buffer.from(verification.codeHash, "hex");
  const actualHash = Buffer.from(hashCode(input.challengeToken, input.code), "hex");
  if (expectedHash.length !== actualHash.length || !timingSafeEqual(expectedHash, actualHash)) {
    await Verifications.updateOne(
      {
        _id: verification._id,
        attempts: verification.attempts,
        consumedAt: null,
        expiresAt: { $gt: now },
      },
      { $inc: { attempts: 1 } },
    );
    throw new CustomerMobileVerificationRejectedError();
  }

  const consumed = await Verifications.findOneAndUpdate(
    {
      _id: verification._id,
      attempts: verification.attempts,
      consumedAt: null,
      expiresAt: { $gt: now },
    },
    { $set: { consumedAt: now } },
    { returnDocument: "after" },
  ).exec();
  if (!consumed) throw new CustomerMobileVerificationRejectedError();

  const marked = await markCustomerMobileVerified(
    connection,
    verification.customerId.toHexString(),
    verification.mobile,
    now,
  );
  if (!marked) throw new CustomerMobileVerificationRejectedError();
  return verification.customerId.toHexString();
}
