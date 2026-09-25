# Settings service and cache behavior

## Typed application boundary

`createSettingsServices` is the overwrite-style application service for the six mutable singleton
sections: Homepage, Contact, Social, About, FAQ, and Languages. It dispatches each key to its exact Zod
codec before any repository write and validates stored revisions again on reads and publication. Unknown,
cross-section, and malformed shapes fail closed.

Terms is intentionally not accepted by this service. SK-0121 stores legal documents as immutable policy
versions with append-only consent evidence; administrators must use that typed policy lifecycle instead of
overwriting a singleton. Together, the mutable service and policy lifecycle provide typed operations for all
seven Settings areas without introducing two authoritative Terms stores.

The private repository converts Mongoose documents to serializable snapshots and uses shared optimistic
concurrency. A concurrent save produces `settings_conflict`; it never overwrites the winner. Direct sections
publish a new revision in one save. Staged edits receive a newer draft revision, remain invisible publicly,
and move to the published slot only through explicit publication.

## Authorization

Authorization is enforced inside the application service, independently of future route/page UI:

| Operation/section                 | Permission                   |
| --------------------------------- | ---------------------------- |
| Administrator read                | `settings:read`              |
| Homepage, About, and FAQ update   | `settings:update-content`    |
| Contact, Social, Languages update | `settings:update-operations` |
| Legal-policy lifecycle            | `settings:update-security`   |

Viewers can read settings but cannot mutate them. Managers can edit content and operations. Owner-only legal
policy mutation remains on the immutable policy boundary. Public reads require no actor but expose only a
published revision and pass Contact, Social, FAQ, and Languages through their public projection functions.
Private Contact entries therefore never enter the shared public cache.

## Cache and revalidation

`createNextSettingsPublicCache` stores locale/fallback-specific public projections in the Next Data Cache.
Each entry has a 60-second safety backstop and exactly one section tag:

```text
sk:v1:settings:item:<section>
```

Direct updates invalidate after the durable write. Draft saves do not invalidate because public content did
not change. Publishing a staged revision invalidates the Settings list, exact section item, and dependent SEO
list through the shared cache policy. Route composition uses `revalidateTag(tag, {expire: 0})`, so the next
server read blocks for fresh data. Already-open clients still need their normal `router.refresh()` after a
successful mutation; tag invalidation is not a browser push channel.

## Audit summaries

Administrator reads, denied attempts, failures, direct updates, draft saves, and publications emit canonical
English audit events. Mutation context contains only bounded changed paths, counts, revision numbers,
publication state, and truncation state. It never stores old/new values, translated copy, contact details, or
rich-text bodies. At most 24 sorted paths enter an audit summary.

## Verification

- Unit tests cover permission mapping, schema dispatch, malformed input, conflict translation, direct versus
  staged behavior, bounded value-free diffs, exact cache configuration, audit mapping, and read-after-
  revalidation behavior.
- MongoDB integration coverage proves direct revision persistence, staged draft isolation, publication,
  public projection, audit invocation, and precise cache invalidation using the real repository.
