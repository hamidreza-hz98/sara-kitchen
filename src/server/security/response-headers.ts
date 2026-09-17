export type SecurityHeaderOptions = {
  production: boolean;
  mediaOrigin?: string;
  mapTileOrigin?: string;
  mapFrameOrigin?: string;
};

export type SecurityHeader = { key: string; value: string };

export const DEFAULT_MAP_TILE_ORIGIN = "https://tile.openstreetmap.org";
export const DEFAULT_MAP_FRAME_ORIGIN = "https://www.openstreetmap.org";

function validatedOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new TypeError("CSP sources must use HTTP or HTTPS.");
  }
  if (url.origin === "null" || url.username || url.password) {
    throw new TypeError("CSP sources must be credential-free HTTP(S) origins.");
  }
  if (url.hostname.includes("*")) {
    throw new TypeError("CSP sources must be exact origins without wildcards.");
  }
  return url.origin;
}

function sources(...values: Array<string | undefined>): string {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].join(" ");
}

function isLoopback(origin: string): boolean {
  const hostname = new URL(origin).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function createContentSecurityPolicy(options: SecurityHeaderOptions): string {
  const mediaOrigin = validatedOrigin(options.mediaOrigin);
  const mapTileOrigin = validatedOrigin(options.mapTileOrigin ?? DEFAULT_MAP_TILE_ORIGIN);
  const mapFrameOrigin = validatedOrigin(options.mapFrameOrigin ?? DEFAULT_MAP_FRAME_ORIGIN);
  for (const origin of [mediaOrigin, mapTileOrigin, mapFrameOrigin]) {
    if (options.production && origin?.startsWith("http:") && !isLoopback(origin)) {
      throw new TypeError(
        "Production CSP sources must use HTTPS unless they are loopback origins.",
      );
    }
  }
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${options.production ? "" : " 'unsafe-eval'"}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    `img-src ${sources("'self'", "data:", "blob:", mapTileOrigin, mediaOrigin)}`,
    `media-src ${sources("'self'", "blob:", mediaOrigin)}`,
    `connect-src ${sources("'self'", options.production ? undefined : "ws:", mediaOrigin)}`,
    `frame-src ${sources(mapFrameOrigin)}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(options.production ? ["upgrade-insecure-requests"] : []),
  ];
  return `${directives.join("; ")};`;
}

export function createSecurityHeaders(options: SecurityHeaderOptions): readonly SecurityHeader[] {
  const headers: SecurityHeader[] = [
    { key: "Content-Security-Policy", value: createContentSecurityPolicy(options) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value:
        "accelerometer=(), autoplay=(), browsing-topics=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(self), geolocation=(self), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
    },
    { key: "X-DNS-Prefetch-Control", value: "off" },
    { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
    { key: "X-XSS-Protection", value: "0" },
  ];
  if (options.production) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains",
    });
  }
  return headers;
}
