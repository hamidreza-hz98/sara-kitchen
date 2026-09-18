export const CONTENT_AREAS = [
  "settings",
  "categories",
  "ingredients",
  "dishes",
  "blogs",
  "seo",
] as const;
export type ContentArea = (typeof CONTENT_AREAS)[number];

export const CONTENT_REVALIDATE_SECONDS = 60;
const SAFE_IDENTIFIER = /^[A-Za-z0-9_-]{1,100}$/u;

export type ContentChange = {
  area: ContentArea;
  /** Immutable IDs; include both old and new IDs if identity can change. */
  ids?: readonly string[];
};

export type CacheTag = `sk:v1:${ContentArea}:list` | `sk:v1:${ContentArea}:item:${string}`;

export function contentListTag(area: ContentArea): CacheTag {
  return `sk:v1:${area}:list`;
}

export function contentItemTag(area: ContentArea, id: string): CacheTag {
  if (!SAFE_IDENTIFIER.test(id)) {
    throw new TypeError("Cache item IDs must be 1–100 safe characters.");
  }
  return `sk:v1:${area}:item:${id}`;
}

/** Tags to attach to a cached public read, including source dependencies. */
export function tagsForContentRead(
  area: ContentArea,
  options: { id?: string; dependencies?: readonly ContentArea[] } = {},
): readonly CacheTag[] {
  const tags: CacheTag[] = [
    options.id ? contentItemTag(area, options.id) : contentListTag(area),
    ...(area === "seo" && options.id ? [contentListTag("seo")] : []),
    ...(options.dependencies ?? []).map(contentListTag),
  ];
  return [...new Set(tags)];
}

/** For cacheable server fetches; MongoDB reads use equivalent cacheTag/cacheLife. */
export function contentFetchCacheOptions(
  area: ContentArea,
  options: { id?: string; dependencies?: readonly ContentArea[] } = {},
) {
  return {
    next: {
      tags: tagsForContentRead(area, options),
      revalidate: CONTENT_REVALIDATE_SECONDS,
    },
  } as const;
}

/** Compute exact affected tags; never use a whole-site/layout cache purge. */
export function tagsForContentChange(change: ContentChange): readonly CacheTag[] {
  const tags: CacheTag[] = [
    contentListTag(change.area),
    ...(change.ids ?? []).map((id) => contentItemTag(change.area, id)),
  ];
  if (change.area !== "seo") tags.push(contentListTag("seo"));
  return [...new Set(tags)];
}

/** Keep the mutation/Next.js adapter testable without a framework request context. */
export function createContentRevalidator(invalidate: (tag: CacheTag) => void) {
  return (change: ContentChange): readonly CacheTag[] => {
    const tags = tagsForContentChange(change);
    for (const tag of tags) invalidate(tag);
    return tags;
  };
}
