import { createHmac } from "node:crypto";
import { isIP } from "node:net";

import { isValidObjectId } from "mongoose";

import type {
  AuditActorKind,
  AuditContext,
  AuditContextValue,
  AuditNetworkPolicy,
} from "../types/audit-event";

export const AUDIT_ACTION_CODE_PATTERN = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9-]*){1,7}$/u;
export const AUDIT_ENTITY_KIND_PATTERN = /^[a-z][a-z0-9-]{1,63}$/u;
export const AUDIT_REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/u;
export const AUDIT_IP_HASH_PATTERN = /^[a-f0-9]{64}$/u;
export const AUDIT_CONTEXT_KEY_PATTERN = /^[a-z][A-Za-z0-9]{0,63}$/u;

const forbiddenContextKey =
  /(password|passphrase|token|secret|authorization|cookie|credential|apiKey|signature|session|card|pan|cvv|message|body|content|description|note|address|email|mobile|phone)/iu;
const forbiddenContextString =
  /(bearer\s+[A-Za-z0-9._~+/-]+=*|\$argon2(?:id|i|d)\$|mongodb(?:\+srv)?:\/\/[^\s:@/]+:[^\s@/]+@|-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:\d[ -]*?){13,19}\b)/iu;

function containsControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 32 || (codePoint >= 127 && codePoint <= 159);
  });
}

export function isSafeAuditText(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxLength &&
    !containsControlCharacter(value)
  );
}

export function isEnglishAuditMessage(value: unknown): value is string {
  return (
    isSafeAuditText(value, 240) &&
    [...value].every((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint >= 32 && codePoint <= 126;
    })
  );
}

export function isSafeAuditContext(value: unknown): value is AuditContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value) as object | null;
  if (prototype !== Object.prototype && prototype !== null) return false;
  const entries = Object.entries(value);
  if (entries.length > 20) return false;

  for (const [key, contextValue] of entries) {
    if (!AUDIT_CONTEXT_KEY_PATTERN.test(key) || forbiddenContextKey.test(key)) return false;
    if (
      contextValue !== null &&
      typeof contextValue !== "string" &&
      typeof contextValue !== "number" &&
      typeof contextValue !== "boolean"
    ) {
      return false;
    }
    if (typeof contextValue === "string") {
      if (!isSafeAuditText(contextValue, 256) || forbiddenContextString.test(contextValue)) {
        return false;
      }
    }
    if (typeof contextValue === "number" && !Number.isFinite(contextValue)) return false;
  }
  return Buffer.byteLength(JSON.stringify(value), "utf8") <= 4_096;
}

export function sanitizeAuditContext(
  value: Readonly<Record<string, AuditContextValue>> | undefined,
): AuditContext {
  const context = Object.freeze({ ...(value ?? {}) });
  if (!isSafeAuditContext(context)) {
    throw new TypeError("Audit context contains prohibited, nested, oversized, or unsafe data.");
  }
  return context;
}

export function isValidAuditActorReference(kind: AuditActorKind, reference: unknown): boolean {
  return kind === "admin" || kind === "customer"
    ? typeof reference === "string" && isValidObjectId(reference)
    : reference === null || reference === undefined;
}

export function isValidAuditNetwork(
  policy: AuditNetworkPolicy,
  ipHash: unknown,
  ipAddress: unknown,
): boolean {
  if (policy === "hashed") {
    return typeof ipHash === "string" && AUDIT_IP_HASH_PATTERN.test(ipHash) && ipAddress === null;
  }
  if (policy === "retained") {
    return ipHash === null && typeof ipAddress === "string" && isIP(ipAddress) !== 0;
  }
  return policy === "omitted" && ipHash === null && ipAddress === null;
}

export function hashAuditIpAddress(ipAddress: string, secret: string): string {
  if (isIP(ipAddress) === 0) throw new TypeError("Audit IP hashing requires a valid IP address.");
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new TypeError("Audit IP hashing requires at least 32 bytes of secret material.");
  }
  return createHmac("sha256", secret)
    .update("sara-kitchen:audit-ip:v1\0", "utf8")
    .update(ipAddress, "utf8")
    .digest("hex");
}
