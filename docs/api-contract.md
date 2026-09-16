# API response and error contract (SK-0040)

Every JSON Route Handler executes through `handleApiRoute()` from the server-only `@/server/http`
public API. The boundary creates or propagates a safe request ID, emits consistent JSON, prevents
cache storage by default, and turns thrown public errors into stable client contracts.

## Envelopes

Successful responses use the requested 2xx status (except bodyless `204`) and this shape:

```json
{
  "ok": true,
  "data": {},
  "meta": {},
  "requestId": "f9e5d4c0-6e67-4f62-8674-22865738a4ae"
}
```

`meta` is optional and is intended for pagination or other response-level information. Failures use:

```json
{
  "ok": false,
  "error": {
    "type": "validation",
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": {
      "issues": [{ "code": "required", "message": "Name is required.", "path": ["name"] }]
    }
  },
  "requestId": "f9e5d4c0-6e67-4f62-8674-22865738a4ae"
}
```

The body and `x-request-id` response header always contain the same ID. A valid upstream ID is
propagated; malformed, control-character, empty, or oversized values are replaced with a UUID. API
logs and audit events use this ID for correlation. The handler boundary sets `Cache-Control: no-store`
unless a future explicitly reviewed public-cache contract replaces it.

## Error taxonomy

| Type             | Stable code               | Status | Public use                                       |
| ---------------- | ------------------------- | -----: | ------------------------------------------------ |
| `validation`     | `VALIDATION_ERROR`        |    400 | Localized, field-safe request issues             |
| `authentication` | `AUTHENTICATION_REQUIRED` |    401 | Missing, invalid, or expired credentials         |
| `authorization`  | `ACCESS_DENIED`           |    403 | Authenticated principal lacks permission         |
| `notFound`       | `NOT_FOUND`               |    404 | Authorized lookup cannot find the resource       |
| `conflict`       | `CONFLICT`                |    409 | Uniqueness, stale state, or business conflict    |
| `rateLimit`      | `RATE_LIMITED`            |    429 | Bounded retry delay; also emits `Retry-After`    |
| `unavailable`    | `SERVICE_UNAVAILABLE`     |    503 | Required dependency is unavailable               |
| `internal`       | `INTERNAL_ERROR`          |    500 | Fixed opaque response; diagnostic is server-only |

Use `ApiError` factories rather than status literals. Details are deliberately allowlisted to field,
resource, retry delay, validation issues, and fixed dependency readiness states. Authentication and authorization are separate: a known
principal without permission receives `403`; missing/invalid credentials receive `401`. Services
must avoid disclosing whether a resource exists when that fact itself is unauthorized.

## Internal-error safety

Unknown errors and `ApiError.internal()` always serialize to the fixed public `INTERNAL_ERROR`
message. The serializer never copies an exception, stack, cause, driver payload, database key, URI,
credential, or arbitrary detail object into JSON—in development or production. The original error is
sent only to `onInternalError` with method, query-free pathname, and request ID. The logs module will
replace the default server console reporter when it is implemented.

```ts
export function POST(request: Request) {
  return handleApiRoute(request, async ({ requestId }) => {
    const dish = await dishes.create(command, { requestId });
    return apiSuccess(dish, { status: 201 });
  });
}
```

Validation adapters convert Zod issues to localized `ApiValidationIssue` values. See
[`request-validation.md`](./request-validation.md) for transport parsing and field-safety rules.
Module services may throw `ApiError` only at an HTTP-aware adapter boundary; domain code should retain
domain-specific failures and let the Route Handler map them.

## Enforcement

`pnpm check:api-contract` scans every `src/app/**/route.ts(x)` file. It requires the public HTTP import
and `handleApiRoute()` and rejects ad hoc `Response.json`, `NextResponse.json`, or `new Response`
construction. `/api/health` and `/api/ready` are executable references for liveness and sanitized
dependency failures; see [`health-readiness.md`](./health-readiness.md). Streaming/binary routes
will require an explicit reviewed extension of this contract; they must still preserve request IDs
and safe error serialization.
