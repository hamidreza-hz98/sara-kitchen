export const MEDIA_LIST_PAGE_SIZES = [12, 24, 48] as const;
export const MEDIA_LIST_VIEWS = ["grid", "list"] as const;
export const MEDIA_LIST_KINDS = ["image", "video", "pdf"] as const;
export const MEDIA_LIST_USAGE = ["used", "unused"] as const;
export const MEDIA_LIST_STATES = ["pending", "processing", "ready", "failed"] as const;
export const MEDIA_LIST_SORTS = [
  "createdAt:desc",
  "createdAt:asc",
  "originalName:asc",
  "originalName:desc",
  "bytes:desc",
  "bytes:asc",
  "usageCount:desc",
  "usageCount:asc",
] as const;

type ArrayValue<Values extends readonly unknown[]> = Values[number];

export type MediaListUiQuery = Readonly<{
  kind?: ArrayValue<typeof MEDIA_LIST_KINDS>;
  page: number;
  pageSize: ArrayValue<typeof MEDIA_LIST_PAGE_SIZES>;
  processingState?: ArrayValue<typeof MEDIA_LIST_STATES>;
  search?: string;
  sortBy: "bytes" | "createdAt" | "originalName" | "usageCount";
  sortDirection: "asc" | "desc";
  usage?: ArrayValue<typeof MEDIA_LIST_USAGE>;
  view: ArrayValue<typeof MEDIA_LIST_VIEWS>;
}>;

function member<Values extends readonly string[]>(
  values: Values,
  value: string | null,
): ArrayValue<Values> | undefined {
  return value !== null && values.includes(value) ? (value as ArrayValue<Values>) : undefined;
}

function positiveInteger(value: string | null, fallback: number): number {
  if (!value || !/^\d+$/u.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseMediaListUiQuery(source: URLSearchParams): MediaListUiQuery {
  const sort = member(MEDIA_LIST_SORTS, source.get("sort")) ?? "createdAt:desc";
  const [sortBy, sortDirection] = sort.split(":") as [MediaListUiQuery["sortBy"], "asc" | "desc"];
  const requestedPageSize = positiveInteger(source.get("pageSize"), MEDIA_LIST_PAGE_SIZES[0]);
  const search = source.get("search")?.trim();
  const kind = member(MEDIA_LIST_KINDS, source.get("kind"));
  const usage = member(MEDIA_LIST_USAGE, source.get("usage"));
  const processingState = member(MEDIA_LIST_STATES, source.get("processingState"));

  return {
    page: positiveInteger(source.get("page"), 1),
    pageSize: MEDIA_LIST_PAGE_SIZES.includes(
      requestedPageSize as ArrayValue<typeof MEDIA_LIST_PAGE_SIZES>,
    )
      ? (requestedPageSize as ArrayValue<typeof MEDIA_LIST_PAGE_SIZES>)
      : MEDIA_LIST_PAGE_SIZES[0],
    view: member(MEDIA_LIST_VIEWS, source.get("view")) ?? "grid",
    sortBy,
    sortDirection,
    ...(search && search.length >= 2 ? { search } : {}),
    ...(kind ? { kind } : {}),
    ...(usage ? { usage } : {}),
    ...(processingState ? { processingState } : {}),
  };
}

export function mediaListApiSearchParams(query: MediaListUiQuery): URLSearchParams {
  const result = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
  });
  if (query.search) result.set("search", query.search);
  if (query.kind) result.set("kind", query.kind);
  if (query.usage) result.set("usage", query.usage);
  if (query.processingState) result.set("processingState", query.processingState);
  return result;
}

export function patchMediaListSearchParams(
  source: URLSearchParams,
  patch: Readonly<Record<string, number | string | undefined>>,
): URLSearchParams {
  const result = new URLSearchParams(source);
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === "") result.delete(key);
    else result.set(key, String(value));
  }
  return result;
}
