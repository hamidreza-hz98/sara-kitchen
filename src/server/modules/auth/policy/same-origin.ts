import "server-only";

export function isSameOriginMutation(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const target = new URL(request.url);
    const supplied = new URL(origin);
    if (supplied.origin !== origin) return false;
    const host = request.headers.get("host");
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto");
    if (forwardedHost && (!host || forwardedHost.toLowerCase() !== host.toLowerCase()))
      return false;
    if (forwardedProto && forwardedProto !== "http" && forwardedProto !== "https") return false;
    // Next may expose an internal request URL (for example localhost) behind a proxy. The
    // browser-facing Host must agree with forwarded-host before it can replace that URL.
    if (host && !forwardedHost && host.toLowerCase() !== target.host.toLowerCase()) return false;
    const publicTarget =
      host && forwardedHost
        ? new URL(`${forwardedProto ?? target.protocol.slice(0, -1)}://${host}/`)
        : target;
    if (supplied.origin !== publicTarget.origin) return false;
    if (forwardedProto && forwardedProto !== publicTarget.protocol.slice(0, -1)) return false;
    const fetchSite = request.headers.get("sec-fetch-site");
    if (fetchSite && fetchSite !== "same-origin") return false;
    return true;
  } catch {
    return false;
  }
}
