# Safe media deletion

`DELETE /api/media/:mediaId` is an authenticated dashboard mutation requiring the `media:delete`
permission and the normal admin CSRF/origin proof. The route accepts no query parameters or request
body controls; in particular, `force=true` is rejected. The project has not approved force deletion.

## Reference invariant

Media owns the denormalized `usageCount` reference counter. Categories, dishes, blogs, and settings
must change references through Media's future public reference API in the same consistency boundary as
their own mutation. They must never write `usageCount` directly or import the Media model. A positive
counter blocks deletion with `409 Conflict`.

The repository performs one atomic transition filtered by both `deletedAt: null` and `usageCount: 0`.
This is not a check-then-write sequence: if a content reference is present or wins a concurrent race,
the soft delete cannot match. Missing and already-recycled records return `404` without revealing their
history.

## Recycle and purge policy

Successful deletion records `deletedAt`, `deletedBy`, and `updatedBy`, returns the deletion time and a
30-day `purgeEligibleAt`, and emits an English `crud.resource.delete` audit event with status
`recycled`. Ordinary reads already exclude recycled records.

No object is removed from MinIO during this request. Original and derived object keys remain intact for
the entire recycle window. A future privileged maintenance purge must be a separate, auditable process
that rechecks `usageCount === 0`, requires `deletedAt` to be at least 30 days old, deletes every managed
object idempotently, and only then retires the database tombstone. Such a purge endpoint/job is not
exposed by SK-0079, preventing accidental early or client-driven object destruction.
