import "server-only";

export const STATIC_SEO_PAGES = {
  home: { path: "/", slug: "home" },
  menu: { path: "/menu", slug: "menu" },
  about: { path: "/about", slug: "about" },
  contact: { path: "/contact", slug: "contact" },
  blog: { path: "/blog", slug: "blog" },
  faq: { path: "/faq", slug: "faq" },
  terms: { path: "/terms", slug: "terms" },
} as const;

export type StaticSeoPageKey = keyof typeof STATIC_SEO_PAGES;

export const STATIC_SEO_PAGE_KEYS = Object.freeze(
  Object.keys(STATIC_SEO_PAGES) as StaticSeoPageKey[],
);

export const SEO_EXCLUDED_PATH_PREFIXES = [
  "/authentication",
  "/forgot-password",
  "/login",
  "/signup",
  "/reset-password",
  "/dashboard",
  "/profile",
  "/cart",
  "/payment-result",
] as const;

export function isStaticSeoPageKey(value: string): value is StaticSeoPageKey {
  return Object.hasOwn(STATIC_SEO_PAGES, value);
}

export function isSeoExcludedPath(path: string): boolean {
  return SEO_EXCLUDED_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

const approvedPaths = STATIC_SEO_PAGE_KEYS.map((key) => STATIC_SEO_PAGES[key].path);
if (new Set(approvedPaths).size !== approvedPaths.length) {
  throw new Error("Static SEO registry contains duplicate routes.");
}
if (approvedPaths.some(isSeoExcludedPath)) {
  throw new Error("Static SEO registry contains an excluded route.");
}
