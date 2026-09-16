# MongoDB schema conventions (SK-0036)

Every domain model starts with `createBaseSchema()` from `@/server/database`. Modules own their schemas and models privately, but the shared factory makes persistence metadata and serialization predictable. A module must not recreate these fields or replace the common transform locally.

## Base fields and options

| Convention               | Stored behavior                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `_id`                    | Mongoose/MongoDB `ObjectId`; never accept a client-generated identifier without validation.                                                                  |
| `createdAt`, `updatedAt` | Mongoose timestamps in UTC `Date` values. `updatedAt` changes on supported writes.                                                                           |
| `schemaVersion`          | Positive safe integer, required, default `1` or the factory's explicit version. Migrations increment it; it is independent from `__v`.                       |
| `__v`                    | Retained internally for Mongoose optimistic concurrency and removed from JSON.                                                                               |
| `createdBy`, `updatedBy` | Optional actor metadata using `{kind, actorId}`. Admin/customer actors require an `ObjectId`; system actors have no actor ID.                                |
| JSON                     | Includes string `id`, omits `_id`, `__v`, and normalized search internals, flattens maps, preserves dates, and converts nested `ObjectId` values to strings. |

Public APIs still map documents to explicit DTOs. The common `toJSON` transform prevents accidental persistence leakage; it is not a substitute for authorization, field allowlists, privacy filtering, or translation selection.

Services set `createdBy` on user-initiated creation and `updatedBy` on mutation. A null actor is permitted for legacy import/migration stages where provenance is genuinely unavailable. Audit logging remains a separate requirement and must not be inferred from these snapshot fields.

## Soft deletion

Soft deletion is opt-in with `{softDelete: true}` and adds nullable `deletedAt` and `deletedBy` fields plus an index on `deletedAt`. Both values must be set or cleared together. `createActorMetadata("system")` represents retention or maintenance jobs.

There is intentionally no hidden query middleware. Repositories must add `ACTIVE_DOCUMENT_FILTER` to ordinary reads and updates, and expose an explicit authorized operation for `withDeleted` or `onlyDeleted` behavior. This keeps counts, aggregations, uniqueness checks, and administrative recovery auditable. Unique indexes on soft-deleted collections should use an appropriate partial filter so a retired value can be reused only when the product rule allows it.

Hard deletion remains appropriate for ephemeral records, expired tokens, idempotency keys, and data whose retention policy requires physical removal. The owning module documents that choice.

## Normalized search

Schemas opt in with `searchSourcePaths`. During document validation the factory builds a hidden, indexed `normalizedSearchText` value. Normalization:

- applies Unicode compatibility decomposition and removes combining marks;
- lowercases Latin text and removes Portuguese diacritics;
- harmonizes Arabic `ي`/`ك` with Persian `ی`/`ک`;
- removes Arabic/Persian diacritics and zero-width characters;
- converts Arabic and Persian digits to ASCII;
- replaces punctuation with spaces, collapses whitespace, and removes duplicate source values.

Specify leaf paths containing only values intended for search. For translation arrays, modules should provide or derive the translated text values rather than indexing locale codes or unrelated subdocument metadata.

Document `validate()`/`save()` refreshes the search field. Query updates such as `updateOne()` and `findOneAndUpdate()` do not run document validation middleware reliably enough to rebuild derived values; repositories changing a search source must load and save the document or explicitly `$set` a value produced by `buildNormalizedSearchText()`.

The normalized field supports deterministic equality and prefix-oriented repository strategies. More advanced language-aware full-text ranking requires a separate indexed search design rather than regex scans over user-facing fields.

## Translated values

Multilingual entities define their required embedded array with `createTranslationsField()`. The
helper enforces one entry per supported locale and non-empty canonical English identity text while
keeping locale-independent data on the aggregate root. See
[`translation-values.md`](./translation-values.md) for the complete placement, validation, draft,
publication, and repository-update contract.

## Example

```ts
type CategoryDocument = BaseDocumentFields &
  SoftDeleteFields &
  NormalizedSearchFields & {
    name: string;
  };

const categorySchema = createBaseSchema<CategoryDocument>(
  { name: { type: String, required: true } },
  {
    schemaVersion: 1,
    searchSourcePaths: ["name"],
    softDelete: true,
  },
);
```

The schema and model stay private inside the owning module. Its public `index.ts` exposes use cases and serializable DTOs, never this persistence type.

## Verification

Unit tests cover option validation, actor rules, multilingual normalization, opt-in deletion fields, paired deletion provenance, indexes, and JSON output. Integration tests persist a representative model and verify timestamps, schema version, hidden search selection, actor serialization, and explicit active-record filtering against MongoDB.
