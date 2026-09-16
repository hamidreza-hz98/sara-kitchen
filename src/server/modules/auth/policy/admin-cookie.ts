import "server-only";

const ADMIN_COOKIE_PRODUCTION = "__Host-sara_admin";
const ADMIN_COOKIE_DEVELOPMENT = "sara_admin_dev";

export function adminCookieName(secure = process.env.NODE_ENV === "production"): string {
  return secure ? ADMIN_COOKIE_PRODUCTION : ADMIN_COOKIE_DEVELOPMENT;
}

export function serializeAdminCookie(
  token: string,
  expiresAt: Date,
  secure = process.env.NODE_ENV === "production",
): string {
  const remainingSeconds = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1_000));
  return `${adminCookieName(secure)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${remainingSeconds}; Expires=${expiresAt.toUTCString()}${secure ? "; Secure" : ""}`;
}

export function clearAdminCookie(secure = process.env.NODE_ENV === "production"): string {
  return `${adminCookieName(secure)}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure ? "; Secure" : ""}`;
}
