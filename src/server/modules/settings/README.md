# Settings

Owns typed/versioned Homepage, Contact, Social, About, FAQ, Terms, and Language settings. It may consume public APIs from Media, Categories, Dishes, and Blogs to validate configured references. Public projections omit operational secrets.

The seven approved MVP keys live in one singleton registry. Homepage, About, FAQ, and Terms use staged
draft/published revisions; Contact, Social, and Languages publish directly. Every retained revision owns
translated JSON, locale-neutral data, editor provenance, and edit/publication timestamps. Section tasks
add exact payload codecs on top of the bounded safe-JSON envelope.

Stored schema changes use ordered, idempotent migrations and optimistic version replacement. Unknown keys,
future versions, and missing migration steps fail closed. See
[`settings-storage.md`](../../../../../docs/settings-storage.md) for the persistence and migration contract.
