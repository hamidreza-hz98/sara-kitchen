# Media create/upload

## HTTP contract

`POST /api/media` accepts one `multipart/form-data` request in the Node.js runtime. It requires an
authenticated admin with `media:create` permission and the admin CSRF/origin proof. The complete request
body is limited to 3.5 MiB before multipart parsing.

Fields:

- `file`: exactly one image eligible for inline processing.
- `translations`: a JSON array of `{ "locale": "en|pt|fa", "alt": "..." }`. English is required,
  locales must be unique, and alt text must contain 1–500 characters.

Success returns `201` with the Media id, SHA-256 checksum, and generated variant count. Duplicate content
returns `409`; malformed, disallowed, quota-exceeding, or unsupported input returns a field-safe `400`.
Unavailable object storage returns `503`. Responses use the shared API envelope and request ID.

## Processing and persistence flow

1. Bound and incrementally read the request body before the platform multipart decoder allocates it.
2. Validate file count, translated alt text, original name, byte count, extension, MIME declaration, and
   magic-byte signature using the upload policy.
3. Read the admitted image into bounded memory, calculate its SHA-256 checksum, and reject an active match.
4. Decode once with Sharp, normalize orientation, remove metadata, and create the four deterministic image
   variants defined by the image-processing policy.
5. Recheck active-storage quota including derived bytes.
6. Upload the original and variants to the configured private bucket under collision-proof keys.
7. Insert one `ready` Media document after every object write succeeds. A partial unique checksum index is
   the final concurrency guard against simultaneous duplicate uploads.

The current inline ceiling is deliberately small, so request admission is streamed but processing buffers
only the accepted image. Video, PDF, and larger images remain unsupported until a durable background worker
is approved.

## Atomicity and cleanup

MongoDB and MinIO cannot share a transaction. The service therefore uses a compensating transaction:

- it records every attempted object key before writing it;
- an object or database failure deletes attempted keys in reverse order;
- each deletion receives up to three attempts;
- no Media document is written until all objects exist;
- a duplicate-key race removes only the losing request's collision-proof objects;
- a cleanup failure becomes the stable internal `rollback_failed` condition rather than reporting success.

This guarantees normal and tested failure paths leave neither an orphan database record nor an orphan object.
A future reconciliation job should inspect exceptional cleanup failures caused by a sustained MinIO outage.

## Observability and privacy

Successful uploads append the generic English `crud.resource.create` audit event without filenames or image
content. Failed service attempts emit the bounded-cardinality `media.upload.failure` operational metric.
HTTP logging supplies the request ID and status while shared redaction prevents credentials, cookies, and
multipart content from entering logs.

## Verification

- Unit tests cover validation, checksum duplicate prevention, successful object/record creation, storage
  failure cleanup, database failure cleanup, route authentication, CSRF, multipart limits, and API errors.
- MongoDB integration tests prove a successful ready record and quota projection, enforce checksum uniqueness,
  and inject a storage failure to confirm that the object store and database retain no partial upload.
