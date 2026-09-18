# Media metadata update

`PATCH /api/media/:mediaId` requires an active administrator with `media:update`, a valid same-origin
CSRF token, a JSON body, and an active Media ObjectId. Successful responses contain only the ID,
display filename, and translated alt values.

## Editable fields

- `originalName` is optional. It must be an NFC-normalized safe filename of at most 180 UTF-8 bytes,
  may contain letters, numbers, spaces, underscores, or hyphens, and must preserve the existing extension
  case-insensitively. Preserving the extension prevents metadata from contradicting the immutable MIME
  and stored object.
- `translations` is optional but, when supplied, replaces the complete alt-text set. Locales must be
  unique, limited to `en`, `pt-PT`, and `fa`, and include nonempty canonical English text. Each alt value
  is trimmed and limited to 500 characters.

At least one editable field is required. The strict input schema rejects every unknown field, including
`source`, `provider`, `bucket`, `objectKey`, `externalUrl`, `mimeType`, `kind`, `bytes`, `dimensions`,
`durationMs`, `pageCount`, `checksum`, `processingState`, `failureCode`, `variants`, `uploaderId`,
`usageCount`, lifecycle fields, actor metadata, and schema/version fields.

## Persistence and concurrency

The repository loads an active document, records its Mongoose version, mutates only allowlisted paths,
sets `updatedBy` to the authenticated admin, and calls `save()`. This keeps full schema validation,
timestamps, normalized filename/alt search material, and optimistic concurrency active. A simultaneous
edit that wins after the snapshot was read causes `409 Conflict`; missing or soft-deleted media returns
`404`. Storage objects are never copied, renamed, rewritten, or deleted by this operation.

Successful mutations append the English `crud.resource.update` audit event. Audit context records only
which editable field groups changed, never filenames or alt content.

Unit and Route Handler tests prove extension, locale, authorization, and strict-field behavior. MongoDB
integration tests prove search material and actor/version metadata update while object keys, variants,
MIME, measurements, checksums, uploader, usage, and storage identity remain unchanged; a stale snapshot
is rejected as an optimistic conflict.
