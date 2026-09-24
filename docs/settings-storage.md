# Versioned settings storage

## Aggregate and singleton registry

Settings use one `SettingsSection` aggregate per approved key in the `settings_sections` collection.
The code-owned registry is the only source of valid keys and assigns each key a current schema version
and publication policy. The unique `settings_singleton_key` index is the concurrency backstop; service
preflight checks added in SK-0123 are for readable errors, not uniqueness enforcement.

| Key         | Policy | Reason                                                               |
| ----------- | ------ | -------------------------------------------------------------------- |
| `homepage`  | Staged | High-impact merchandising changes need review before publication.    |
| `contact`   | Direct | Operational contact details should become authoritative in one save. |
| `social`    | Direct | Link changes are small, independently validated operational updates. |
| `about`     | Staged | Editorial and media changes benefit from preview/review.             |
| `faq`       | Staged | Public support and structured-data content must publish coherently.  |
| `terms`     | Staged | Policy publication must be deliberate and traceable.                 |
| `languages` | Direct | Runtime locale availability must have one unambiguous active state.  |

Unknown keys fail both model validation and migration before any write. Arbitrary dashboard URLs can
therefore never create new settings families.

## Revision shape

Each aggregate contains `draft` and `published` revision slots. A revision carries:

- a positive, monotonically increasing revision number;
- `translations: [{ locale, value }]`, with unique supported locales and required canonical English;
- locale-neutral `data`;
- the editing administrator reference and edit timestamp;
- a publication timestamp only for published revisions.

Staged sections require at least a draft or published revision. When both exist, the draft revision must
be newer, so a draft never destroys the public snapshot. Direct-publish sections contain no draft and
always contain a published revision. Root `createdBy`, `updatedBy`, `createdAt`, and `updatedAt` come from
the shared base-schema convention; revision provenance records the precise editor of retained snapshots.

The generic revision types accept section-specific `data` and translation-value types. SK-0116 through
SK-0122 provide the exact domain codecs and payload types for their respective keys. Until those codecs
authorize a shape, the persistence envelope only accepts bounded, acyclic plain JSON objects: prototype,
operator (`$`), dotted-key, excessive depth/size, non-finite number, and cyclic values fail closed.

## Version and migration contract

`schemaVersion` describes the stored section shape and is independent of Mongoose's `__v` optimistic
concurrency field and the content revision number. The current envelope is version 2. Model validation
accepts only the registry's current version; old documents must pass through the migration boundary first.

Migrations are pure, ordered `vN -> vN+1` transformations. The registered v1-to-v2 migration derives the
immutable publication policy from the trusted key registry. It does not trust or infer a browser-provided
policy. Current records are idempotent, while malformed versions, future versions, missing steps, and
unknown keys stop the run.

`migrateSettingsSectionDocuments(connection, { apply })` supports both a read-only plan and an applied
run. Applied replacements compare `_id` plus the source `schemaVersion`; a concurrent modification yields
a write conflict rather than overwriting newer data. The bounded collection has only the seven singleton
documents, and a second successful run performs zero writes.

Deployment migration procedure:

1. Back up the settings collection and run the migration in plan mode.
2. Verify the inspected/migrated counts and test the release against a restored copy.
3. Run apply once before serving code that requires the new schema version.
4. Re-run plan mode and require zero pending migrations.
5. Roll back with the backup and prior application release; automatic down-migrations are intentionally
   unsupported.

## Verification

- Unit tests cover registry policy, translated revisions, state invariants, old-version rejection, safe
  JSON limits, sequential migration, current-version idempotency, and unknown/future version failures.
- MongoDB integration tests prove the singleton unique index and exercise plan, apply, current-model
  validation, and zero-write rerun behavior against a real collection.
