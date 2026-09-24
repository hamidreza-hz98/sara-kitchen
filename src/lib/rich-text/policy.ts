export const RICH_TEXT_SCHEMA_VERSION = 1 as const;
export const RICH_TEXT_MAX_BYTES = 500_000;
export const RICH_TEXT_MAX_DEPTH = 12;
export const RICH_TEXT_MAX_NODES = 5_000;
export const RICH_TEXT_MAX_TEXT_LENGTH = 200_000;

export const RICH_TEXT_NODE_TYPES = [
  "doc",
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "hardBreak",
  "text",
  "media",
] as const;
export const RICH_TEXT_MARK_TYPES = [
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "link",
] as const;

export type RichTextMark =
  | Readonly<{ type: "bold" | "code" | "italic" | "strike" | "underline" }>
  | Readonly<{ attrs: Readonly<{ href: string }>; type: "link" }>;

export type RichTextTextNode = Readonly<{
  marks?: readonly RichTextMark[];
  text: string;
  type: "text";
}>;

export type RichTextContainerNode = Readonly<{
  content?: readonly RichTextNode[];
  type: "blockquote" | "bulletList" | "doc" | "listItem" | "orderedList" | "paragraph";
}>;

export type RichTextHeadingNode = Readonly<{
  attrs: Readonly<{ level: 2 | 3 | 4 }>;
  content?: readonly RichTextNode[];
  type: "heading";
}>;

export type RichTextMediaNode = Readonly<{
  attrs: Readonly<{
    alt: string;
    caption?: string;
    kind: "image" | "video";
    mediaId: string;
  }>;
  type: "media";
}>;

export type RichTextNode =
  | RichTextContainerNode
  | RichTextHeadingNode
  | RichTextMediaNode
  | RichTextTextNode
  | Readonly<{ type: "hardBreak" }>;

export type RichTextDocument = RichTextContainerNode & { type: "doc" };

export type StoredRichText = Readonly<{
  document: RichTextDocument;
  schemaVersion: typeof RICH_TEXT_SCHEMA_VERSION;
}>;

export type RichTextValidationIssue = Readonly<{
  code:
    | "invalid_document"
    | "invalid_link"
    | "invalid_mark"
    | "invalid_media"
    | "invalid_node"
    | "limit_exceeded"
    | "unsupported_version";
  path: string;
}>;

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/iu;
const INLINE_NODES = new Set(["text", "hardBreak"]);
const BLOCK_NODES = new Set([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "blockquote",
  "media",
]);
const SIMPLE_MARKS = new Set(["bold", "italic", "underline", "strike", "code"]);

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function onlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const names = new Set(allowed);
  return Object.keys(value).every((key) => names.has(key));
}

function byteLength(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/** Links are either local paths/fragments, HTTPS URLs, or narrowly parsed mail/tel actions. */
export function normalizeRichTextHref(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const href = value.trim();
  if (!href || href.length > 2_048 || /[\u0000-\u001f\u007f]/u.test(href)) return null;
  if (href.startsWith("#")) return /^#[a-z][\w-]*$/iu.test(href) ? href : null;
  if (href.startsWith("/") && !href.startsWith("//") && !href.includes("\\")) return href;

  try {
    const url = new URL(href);
    if (url.username || url.password) return null;
    if (url.protocol === "https:") return href;
    if (url.protocol === "mailto:" && /^[^?\s@]+@[^?\s@]+\.[^?\s@]+$/u.test(url.pathname)) {
      return `mailto:${url.pathname}`;
    }
    if (url.protocol === "tel:" && /^\+?[\d(). -]{5,32}$/u.test(url.pathname)) {
      return `tel:${url.pathname}`;
    }
  } catch {
    return null;
  }
  return null;
}

function sanitizeMarks(value: unknown): readonly RichTextMark[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result: RichTextMark[] = [];
  const seen = new Set<string>();
  for (const candidate of value) {
    if (!record(candidate) || typeof candidate.type !== "string" || seen.has(candidate.type)) {
      continue;
    }
    if (SIMPLE_MARKS.has(candidate.type) && onlyKeys(candidate, ["type"])) {
      result.push({ type: candidate.type as "bold" });
      seen.add(candidate.type);
      continue;
    }
    if (candidate.type !== "link" || !onlyKeys(candidate, ["type", "attrs"])) continue;
    if (!record(candidate.attrs) || !onlyKeys(candidate.attrs, ["href"])) continue;
    const href = normalizeRichTextHref(candidate.attrs.href);
    if (!href) continue;
    result.push({ type: "link", attrs: { href } });
    seen.add(candidate.type);
  }
  return result.length > 0 ? result : undefined;
}

type SanitizeState = { nodes: number; textLength: number; seen: WeakSet<object> };

function sanitizeNode(
  value: unknown,
  parentType: string,
  depth: number,
  state: SanitizeState,
): RichTextNode | null {
  if (!record(value) || depth > RICH_TEXT_MAX_DEPTH || state.nodes >= RICH_TEXT_MAX_NODES) {
    return null;
  }
  if (state.seen.has(value)) return null;
  state.seen.add(value);
  state.nodes += 1;
  const type = value.type;
  if (typeof type !== "string") return null;

  const permittedChild =
    parentType === "doc" || parentType === "blockquote" || parentType === "listItem"
      ? BLOCK_NODES.has(type)
      : parentType === "bulletList" || parentType === "orderedList"
        ? type === "listItem"
        : INLINE_NODES.has(type);
  if (!permittedChild) return null;

  if (type === "text") {
    if (typeof value.text !== "string" || !onlyKeys(value, ["type", "text", "marks"])) return null;
    const available = Math.max(0, RICH_TEXT_MAX_TEXT_LENGTH - state.textLength);
    if (available === 0) return null;
    const text = value.text.slice(0, available);
    state.textLength += text.length;
    const marks = sanitizeMarks(value.marks);
    return { type: "text", text, ...(marks ? { marks } : {}) };
  }
  if (type === "hardBreak") {
    return onlyKeys(value, ["type"]) ? { type: "hardBreak" } : null;
  }
  if (type === "media") {
    if (!onlyKeys(value, ["type", "attrs"]) || !record(value.attrs)) return null;
    const attrs = value.attrs;
    if (
      !onlyKeys(attrs, ["mediaId", "kind", "alt", "caption"]) ||
      typeof attrs.mediaId !== "string" ||
      !OBJECT_ID_PATTERN.test(attrs.mediaId) ||
      !["image", "video"].includes(String(attrs.kind)) ||
      typeof attrs.alt !== "string" ||
      attrs.alt.trim().length === 0 ||
      attrs.alt.length > 240 ||
      (attrs.caption !== undefined &&
        (typeof attrs.caption !== "string" || attrs.caption.length > 500))
    ) {
      return null;
    }
    return {
      type: "media",
      attrs: {
        mediaId: attrs.mediaId.toLowerCase(),
        kind: attrs.kind as "image" | "video",
        alt: attrs.alt.trim(),
        ...(typeof attrs.caption === "string" && attrs.caption.trim()
          ? { caption: attrs.caption.trim() }
          : {}),
      },
    };
  }
  if (type === "heading") {
    if (
      !onlyKeys(value, ["type", "attrs", "content"]) ||
      !record(value.attrs) ||
      !onlyKeys(value.attrs, ["level"]) ||
      ![2, 3, 4].includes(Number(value.attrs.level))
    ) {
      return null;
    }
    const content = sanitizeChildren(value.content, type, depth, state);
    return {
      type: "heading",
      attrs: { level: value.attrs.level as 2 | 3 | 4 },
      ...(content.length > 0 ? { content } : {}),
    };
  }
  if (
    !["paragraph", "bulletList", "orderedList", "listItem", "blockquote"].includes(type) ||
    !onlyKeys(value, ["type", "content"])
  ) {
    return null;
  }
  const content = sanitizeChildren(value.content, type, depth, state);
  return {
    type: type as Exclude<RichTextContainerNode["type"], "doc">,
    ...(content.length > 0 ? { content } : {}),
  };
}

function sanitizeChildren(
  value: unknown,
  parentType: string,
  depth: number,
  state: SanitizeState,
): readonly RichTextNode[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((child) => {
    const sanitized = sanitizeNode(child, parentType, depth + 1, state);
    return sanitized ? [sanitized] : [];
  });
}

/** Defensive read-side sanitizer. Unknown nodes/attributes/marks are removed, never interpreted. */
export function sanitizeRichTextDocument(value: unknown): RichTextDocument {
  if (!record(value) || value.type !== "doc" || !onlyKeys(value, ["type", "content"])) {
    return { type: "doc", content: [] };
  }
  const state: SanitizeState = { nodes: 1, textLength: 0, seen: new WeakSet([value]) };
  const content = sanitizeChildren(value.content, "doc", 0, state);
  return { type: "doc", content };
}

/** Strict write-side validation: valid content must survive sanitization without any mutation. */
export function validateRichTextDocument(value: unknown): readonly RichTextValidationIssue[] {
  if (byteLength(value) > RICH_TEXT_MAX_BYTES) {
    return [{ code: "limit_exceeded", path: "document" }];
  }
  const sanitized = sanitizeRichTextDocument(value);
  try {
    if (JSON.stringify(value) !== JSON.stringify(sanitized)) {
      return [{ code: "invalid_document", path: "document" }];
    }
  } catch {
    return [{ code: "invalid_document", path: "document" }];
  }
  return [];
}

export function createStoredRichText(document: unknown): StoredRichText {
  const issues = validateRichTextDocument(document);
  if (issues.length > 0) throw new RichTextPolicyError(issues[0]!);
  return {
    schemaVersion: RICH_TEXT_SCHEMA_VERSION,
    document: document as RichTextDocument,
  };
}

/** Reads and migrates a stored value. New migrations must be explicit and sequential. */
export function readStoredRichText(value: unknown): StoredRichText {
  if (!record(value) || value.schemaVersion !== RICH_TEXT_SCHEMA_VERSION) {
    throw new RichTextPolicyError({ code: "unsupported_version", path: "schemaVersion" });
  }
  return createStoredRichText(value.document);
}

export function isStoredRichText(value: unknown): value is StoredRichText {
  try {
    readStoredRichText(value);
    return true;
  } catch {
    return false;
  }
}

export class RichTextPolicyError extends Error {
  readonly issue: RichTextValidationIssue;

  constructor(issue: RichTextValidationIssue) {
    super(`Rich-text policy rejected ${issue.path}: ${issue.code}.`);
    this.name = "RichTextPolicyError";
    this.issue = issue;
  }
}
