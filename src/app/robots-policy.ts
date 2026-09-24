import type { MetadataRoute } from "next";

export const PRIVATE_ROBOTS_PATHS = [
  "/api/",
  "/authentication",
  "/dashboard",
  "/forgot-password",
  "/login",
  "/profile",
  "/reset-password",
  "/signup",
  "/cart",
  "/checkout",
  "/payment-result",
  "/theme-showcase",
] as const;

function canonicalOrigin(siteUrl: string): string {
  const url = new URL(siteUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TypeError("The robots site URL must use HTTP or HTTPS.");
  }
  return url.origin;
}

export function createRobotsPolicy(production: boolean, siteUrl: string): MetadataRoute.Robots {
  if (!production) {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }

  const origin = canonicalOrigin(siteUrl);
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...PRIVATE_ROBOTS_PATHS],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
