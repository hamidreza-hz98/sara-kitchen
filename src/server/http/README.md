# HTTP API contract

Every JSON Route Handler imports `apiSuccess`, `ApiError`, and `handleApiRoute` from the server-only
`@/server/http` public API. Never return ad hoc JSON or serialize caught errors directly.

The wrapper validates or creates `x-request-id`, emits it in every response body/header, applies
`no-store`, serializes the shared envelope, maps public failures to stable status/code pairs, and
reports internal failures server-side without exposing their messages, causes, or stacks.

See `docs/api-contract.md` for shapes, error mapping, logging integration, and handler examples.
