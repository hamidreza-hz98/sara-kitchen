import "server-only";

export function isSameOriginMutation(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const target = new URL(request.url);
    const supplied = new URL(origin);
    if (supplied.origin !== origin || supplied.origin !== target.origin) return false;
    const host = request.headers.get("host");
    if (host && host.toLowerCase() !== target.host.toLowerCase()) return false;
    const forwardedHost = request.headers.get("x-forwarded-host");
    if (forwardedHost && forwardedHost.toLowerCase() !== target.host.toLowerCase()) return false;
    const forwardedProto = request.headers.get("x-forwarded-proto");
    if (forwardedProto && forwardedProto.toLowerCase() !== target.protocol.slice(0, -1))
      return false;
    const fetchSite = request.headers.get("sec-fetch-site");
    if (fetchSite && fetchSite !== "same-origin") return false;
    return true;
  } catch {
    return false;
  }
}
