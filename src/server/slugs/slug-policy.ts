export const SLUG_MAX_LENGTH = 96;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export const SYSTEM_RESERVED_SLUGS = Object.freeze([
  "about",
  "account",
  "activity",
  "admin",
  "admins",
  "api",
  "authentication",
  "blog",
  "cart",
  "categories",
  "checkout",
  "contact",
  "create",
  "customers",
  "dashboard",
  "dishes",
  "edit",
  "ingredients",
  "media",
  "menu",
  "modify",
  "new",
  "next",
  "order",
  "orders",
  "payment-result",
  "profile",
  "settings",
  "theme-showcase",
  "transactions",
] as const);

export const SLUG_POLICY_ERROR_CODES = [
  "invalid_slug_source",
  "invalid_slug_options",
  "slug_candidates_exhausted",
] as const;

export type SlugPolicyErrorCode = (typeof SLUG_POLICY_ERROR_CODES)[number];
export type SlugSource = "generated" | "admin-override" | "existing";
export type SlugTakenCheck = (candidate: string) => boolean | Promise<boolean>;

export type NormalizeSlugOptions = {
  maxLength?: number;
};

export type ResolveSlugOptions = NormalizeSlugOptions & {
  adminOverride?: string | null;
  canonicalText: string;
  currentSlug?: string | null;
  isSlugTaken?: SlugTakenCheck;
  maxCandidates?: number;
  reservedSlugs?: readonly string[];
};

export type SlugResolution = {
  collisionSuffix: number | null;
  slug: string;
  source: SlugSource;
};

const SPECIAL_LATIN_CHARACTERS: Readonly<Record<string, string>> = Object.freeze({
  æ: "ae",
  ð: "d",
  đ: "d",
  ħ: "h",
  ı: "i",
  ł: "l",
  ø: "o",
  œ: "oe",
  ß: "ss",
  þ: "th",
});

export class SlugPolicyError extends Error {
  readonly code: SlugPolicyErrorCode;

  constructor(code: SlugPolicyErrorCode, message: string) {
    super(message);
    this.name = "SlugPolicyError";
    this.code = code;
  }
}

function validateMaxLength(maxLength: number): void {
  if (!Number.isSafeInteger(maxLength) || maxLength < 8 || maxLength > 160) {
    throw new SlugPolicyError(
      "invalid_slug_options",
      "Slug maxLength must be a safe integer between 8 and 160.",
    );
  }
}

function replaceSpecialLatinCharacters(value: string): string {
  return [...value].map((character) => SPECIAL_LATIN_CHARACTERS[character] ?? character).join("");
}

function replaceProjectDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/gu, (digit) => {
    const codePoint = digit.codePointAt(0);
    if (codePoint === undefined) return digit;
    const zero = codePoint >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(codePoint - zero);
  });
}

/** Convert canonical English text or an explicit override to a stable ASCII URL segment. */
export function normalizeSlug(value: string, options: NormalizeSlugOptions = {}): string {
  const maxLength = options.maxLength ?? SLUG_MAX_LENGTH;
  validateMaxLength(maxLength);

  const normalized = replaceProjectDigits(
    replaceSpecialLatinCharacters(value.normalize("NFKD").toLowerCase()),
  )
    .replace(/\p{Mark}+/gu, "")
    .replace(/['’ʻ`]+/gu, "")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .replace(/-{2,}/gu, "-");
  const truncated = normalized.slice(0, maxLength).replace(/-+$/u, "");

  if (!truncated) {
    throw new SlugPolicyError(
      "invalid_slug_source",
      "Slug source must contain at least one Latin letter or digit.",
    );
  }

  return truncated;
}

function buildReservedSet(
  reservedSlugs: readonly string[],
  maxLength: number,
): ReadonlySet<string> {
  return new Set(
    [...SYSTEM_RESERVED_SLUGS, ...reservedSlugs].map((slug) => normalizeSlug(slug, { maxLength })),
  );
}

function appendCollisionSuffix(base: string, suffix: number, maxLength: number): string {
  const ending = `-${suffix}`;
  const availableBaseLength = maxLength - ending.length;
  const truncatedBase = base.slice(0, availableBaseLength).replace(/-+$/u, "");
  return `${truncatedBase}${ending}`;
}

/**
 * Keep an existing slug stable unless an override is supplied. New/overridden slugs use the first
 * non-reserved, non-taken candidate and deterministic numeric suffixes starting at `-2`.
 */
export async function resolveUniqueSlug(options: ResolveSlugOptions): Promise<SlugResolution> {
  const maxLength = options.maxLength ?? SLUG_MAX_LENGTH;
  validateMaxLength(maxLength);

  const hasAdminOverride = options.adminOverride !== undefined && options.adminOverride !== null;
  if (options.currentSlug && !hasAdminOverride) {
    return { collisionSuffix: null, slug: options.currentSlug, source: "existing" };
  }

  const source: SlugSource = hasAdminOverride ? "admin-override" : "generated";
  const base = normalizeSlug(
    hasAdminOverride ? (options.adminOverride as string) : options.canonicalText,
    { maxLength },
  );

  if (options.currentSlug && base === options.currentSlug) {
    return { collisionSuffix: null, slug: options.currentSlug, source };
  }

  const maxCandidates = options.maxCandidates ?? 1_000;
  if (!Number.isSafeInteger(maxCandidates) || maxCandidates < 1 || maxCandidates > 10_000) {
    throw new SlugPolicyError(
      "invalid_slug_options",
      "maxCandidates must be a safe integer between 1 and 10000.",
    );
  }

  const reserved = buildReservedSet(options.reservedSlugs ?? [], maxLength);
  const isSlugTaken = options.isSlugTaken ?? (() => false);

  for (let candidateNumber = 1; candidateNumber <= maxCandidates; candidateNumber += 1) {
    const collisionSuffix = candidateNumber === 1 ? null : candidateNumber;
    const candidate = collisionSuffix
      ? appendCollisionSuffix(base, collisionSuffix, maxLength)
      : base;

    if (reserved.has(candidate)) continue;
    if (!(await isSlugTaken(candidate))) return { collisionSuffix, slug: candidate, source };
  }

  throw new SlugPolicyError(
    "slug_candidates_exhausted",
    `No available slug was found within ${maxCandidates} deterministic candidates.`,
  );
}
