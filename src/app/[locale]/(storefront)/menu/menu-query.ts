// URL allow-lists mirror the public dish catalog contract without importing server code into UI.
export const MENU_SORTS = [
  "recommended",
  "newest",
  "price_asc",
  "price_desc",
  "popular",
  "best_selling",
] as const;
export const MENU_VIEWS = ["grid", "list"] as const;
export const MENU_DIETARY_TAGS = ["vegetarian", "vegan", "halal"] as const;
export const MENU_ALLERGEN_TAGS = [
  "gluten",
  "crustaceans",
  "eggs",
  "fish",
  "peanuts",
  "soybeans",
  "milk",
  "tree_nuts",
  "celery",
  "mustard",
  "sesame",
  "sulphites",
  "lupin",
  "molluscs",
] as const;

export type MenuSearchParams = Record<string, string | string[] | undefined>;
export type MenuQuery = Readonly<{
  search: string;
  category: string;
  sort: (typeof MENU_SORTS)[number];
  view: (typeof MENU_VIEWS)[number];
  availability: "available" | "all" | "unavailable";
  discounted: boolean;
  featured: boolean;
  dietaryTags: readonly (typeof MENU_DIETARY_TAGS)[number][];
  excludeAllergens: readonly (typeof MENU_ALLERGEN_TAGS)[number][];
  page: number;
  invalid: boolean;
}>;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const PAGE_SIZE = 12;
export const MENU_PAGE_SIZE = PAGE_SIZE;

export function parseMenuQuery(params: MenuSearchParams): MenuQuery {
  let invalid = false;
  const single = (key: string): string => {
    const value = params[key];
    if (Array.isArray(value)) {
      invalid = true;
      return "";
    }
    return value ?? "";
  };
  const pick = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
    const value = single(key);
    if (!value) return fallback;
    if (allowed.includes(value as T)) return value as T;
    invalid = true;
    return fallback;
  };
  const flag = (key: string): boolean => {
    const value = single(key);
    if (value && value !== "1") invalid = true;
    return value === "1";
  };
  const multi = <T extends string>(key: string, allowed: readonly T[]): T[] => {
    const raw = params[key];
    const values = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
    if (values.length > allowed.length || values.some((value) => !allowed.includes(value as T))) {
      invalid = true;
      return [];
    }
    return [...new Set(values)] as T[];
  };
  const search = single("q").trim();
  if (search && (search.length < 2 || search.length > 80)) invalid = true;
  const category = single("category");
  if (category && !SLUG.test(category)) invalid = true;
  const rawPage = single("page");
  const page = rawPage ? Number(rawPage) : 1;
  if (!Number.isSafeInteger(page) || page < 1 || page * PAGE_SIZE > 10_000) invalid = true;
  return {
    search: search.length >= 2 && search.length <= 80 ? search : "",
    category: SLUG.test(category) ? category : "",
    sort: pick("sort", MENU_SORTS, "recommended"),
    view: pick("view", MENU_VIEWS, "grid"),
    availability: pick("availability", ["available", "all", "unavailable"], "available"),
    discounted: flag("discounted"),
    featured: flag("featured"),
    dietaryTags: multi("diet", MENU_DIETARY_TAGS),
    excludeAllergens: multi("excludeAllergen", MENU_ALLERGEN_TAGS),
    page: Number.isSafeInteger(page) && page >= 1 && page * PAGE_SIZE <= 10_000 ? page : 1,
    invalid,
  };
}

export function menuHref(query: MenuQuery, changes: Record<string, string | number | null> = {}) {
  const params = new URLSearchParams();
  if (query.search) params.set("q", query.search);
  if (query.category) params.set("category", query.category);
  if (query.sort !== "recommended") params.set("sort", query.sort);
  if (query.view !== "grid") params.set("view", query.view);
  if (query.availability !== "available") params.set("availability", query.availability);
  if (query.discounted) params.set("discounted", "1");
  if (query.featured) params.set("featured", "1");
  for (const tag of query.dietaryTags) params.append("diet", tag);
  for (const tag of query.excludeAllergens) params.append("excludeAllergen", tag);
  if (query.page > 1) params.set("page", String(query.page));
  for (const [key, value] of Object.entries(changes)) {
    params.delete(key);
    if (value !== null) params.set(key, String(value));
  }
  const value = params.toString();
  return `/menu${value ? `?${value}` : ""}`;
}
