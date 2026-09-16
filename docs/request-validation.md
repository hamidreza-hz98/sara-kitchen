# Request validation helpers (SK-0041)

All untrusted Route Handler inputs are parsed through Zod before reaching a module service. The
browser-safe `@/validations/request` package owns reusable schemas and stable issue mapping; the
server-only `@/server/http` package owns transport parsing and converts failures to the SK-0040
`400 VALIDATION_ERROR` response. Feature schemas should be strict at the boundary and reused by
client forms only when their contracts are genuinely identical.

## Transport helpers

| Helper                 | Input and behavior                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `parseJsonRequest`     | Requires `application/json` or `application/*+json`; malformed JSON is a safe 400.  |
| `parseFormDataRequest` | Requires multipart or URL-encoded form input; repeated names become arrays.         |
| `parseQueryParameters` | Accepts Request, URL, or URLSearchParams; repeated keys become arrays.              |
| `parseRouteParameters` | Accepts Next.js promised params and validates resolved values.                      |
| `validateRequestValue` | Validates an already extracted untrusted value.                                     |
| `parseFileMetadata`    | Validates supplied name, size, and MIME type; not a substitute for byte inspection. |

Wrong media types, malformed bodies, invalid schema values, and unrecognized strict-object keys
become `ApiError.validation()` and produce HTTP 400. The parser preserves actual files as `File`
values; media services must additionally inspect streamed bytes, magic signatures, dimensions,
content, and storage policy before accepting them. File metadata alone is never trusted.

## Reusable schemas

`paginationSchema` defaults to page 1 and size 20, caps size at 100 and page at 1,000,000, and
requires positive integers. `createSortSchema(["name", "createdAt"] as const)` allowlists a sort field
and `asc`/`desc` direction. `createFilterSchema()` wraps an explicit shape in a strict object; it does
not make arbitrary MongoDB operators legal. SK-0042 will compose these with resource-specific query
cost controls, stable sort tie-breakers, and database projections.

`createFileMetadataSchema({allowedMimeTypes, maxBytes})` requires a positive integer size, bounded
filename without path separators/control characters, and an explicitly allowed MIME type. It
normalizes MIME case, but extension/MIME consistency and byte signatures remain media-module work.

## Localization and data safety

`getRequestValidationOptions(locale)` creates a `next-intl` translator from the project's checked
English, European Portuguese, or Farsi validation catalog. Pass it to each parser inside the shared
Route Handler boundary:

```ts
export function POST(request: NextRequest) {
  return handleApiRoute(request, async () => {
    const locale = resolveLocalePreference(request.cookies.get(LOCALE_COOKIE_NAME)?.value);
    const options = await getRequestValidationOptions(locale);
    const input = await parseJsonRequest(request, createDishSchema, options);
    return apiSuccess(await dishes.create(input), { status: 201 });
  });
}
```

The active browser cookie selects the response language without a locale URL segment. A missing or
invalid cookie falls back to English. The `/api/health` Route Handler is a safe executable example:
unknown query parameters return localized Portuguese/Farsi 400 envelopes in contract tests.

`localizeZodIssues()` never forwards Zod's raw `message`, rejected input, unrecognized object keys,
exception internals, or arbitrary custom issue text. It emits stable codes, validated catalog text,
and bounded field paths; unsafe path segments become `_`. Missing values are distinguished from
wrong types by inspecting path presence without copying the value. At most 50 issues are returned by
default. Custom refinements use `addLocalizedIssue()` with a known catalog key and numeric ICU
placeholders rather than writing user-derived strings into messages.

Do not use raw `z.coerce.number()` for an endpoint where an empty string should be absent rather than
zero; define its explicit preprocessing and business semantics in that feature schema. Authorization,
ownership, computed prices, file signatures, and payment state require separate server validation.
