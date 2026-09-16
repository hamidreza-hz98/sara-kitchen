import "server-only";

const PRODUCTION_NAME = "__Host-sara_customer";
const DEVELOPMENT_NAME = "sara_customer_dev";

export function customerCookieName(secure = process.env.NODE_ENV === "production"): string {
  return secure ? PRODUCTION_NAME : DEVELOPMENT_NAME;
}

export function serializeCustomerCookie(
  token: string,
  expiresAt: Date,
  persistent: boolean,
  secure = process.env.NODE_ENV === "production",
): string {
  const lifetime = persistent
    ? `; Max-Age=${Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1_000))}; Expires=${expiresAt.toUTCString()}`
    : "";
  return `${customerCookieName(secure)}=${token}; Path=/; HttpOnly; SameSite=Strict${lifetime}${secure ? "; Secure" : ""}`;
}

export function clearCustomerCookie(secure = process.env.NODE_ENV === "production"): string {
  return `${customerCookieName(secure)}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure ? "; Secure" : ""}`;
}
