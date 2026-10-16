export const BLOG_PAGE_SIZE = 9;
export const BLOG_SORTS = ["newest", "oldest", "popular"] as const;
export const BLOG_VIEWS = ["grid", "list"] as const;

export type BlogSearchParams = Record<string, string | string[] | undefined>;
export type BlogQuery = Readonly<{
  search: string;
  sort: (typeof BLOG_SORTS)[number];
  view: (typeof BLOG_VIEWS)[number];
  page: number;
}>;

export function blogHref(query: BlogQuery, changes: Partial<BlogQuery> = {}): string {
  const value = { ...query, ...changes };
  const params = new URLSearchParams();
  if (value.search) params.set("q", value.search);
  if (value.sort !== "newest") params.set("sort", value.sort);
  if (value.view !== "grid") params.set("view", value.view);
  if (value.page > 1) params.set("page", String(value.page));
  const search = params.toString();
  return `/blog${search ? `?${search}` : ""}`;
}

export function parseBlogQuery(params: BlogSearchParams): { query: BlogQuery; canonical: boolean } {
  const raw = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      raw.append(key, entry);
    }
  }
  const single = (key: string) => {
    const value = params[key];
    return typeof value === "string" ? value : "";
  };
  const search = single("q").trim();
  const sort = single("sort");
  const view = single("view");
  const page = Number(single("page") || "1");
  const query: BlogQuery = {
    search: search.length >= 2 && search.length <= 80 ? search : "",
    sort: BLOG_SORTS.includes(sort as BlogQuery["sort"]) ? (sort as BlogQuery["sort"]) : "newest",
    view: BLOG_VIEWS.includes(view as BlogQuery["view"]) ? (view as BlogQuery["view"]) : "grid",
    page: Number.isSafeInteger(page) && page >= 1 && page * BLOG_PAGE_SIZE <= 10_000 ? page : 1,
  };
  const expected = blogHref(query).split("?")[1] ?? "";
  return { query, canonical: raw.toString() === expected };
}
