# Rich-text document policy

## Decision

Sara Kitchen authors rich content with TipTap and stores a constrained ProseMirror-compatible JSON
document. HTML is not a persistence format. Each stored value uses this envelope:

```json
{
  "schemaVersion": 1,
  "document": { "type": "doc", "content": [] }
}
```

The version belongs to the content value, not the containing MongoDB document, so each rich-text
field can be migrated and retried independently. Unknown future versions fail closed. A new version
must add a sequential, deterministic migration before the application may read or write it.

## Allow-list

| Kind  | Allowed values                                                         | Constraints                                                                                   |
| ----- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Nodes | `doc`, `paragraph`, `heading`, `bulletList`, `orderedList`, `listItem` | Headings are levels 2–4; block and inline parent/child relationships are checked.             |
| Nodes | `blockquote`, `hardBreak`, `text`                                      | Text is always rendered as a React text node and is therefore escaped.                        |
| Embed | `media`                                                                | Contains only `mediaId`, `image`/`video` kind, translated alt text, and optional caption.     |
| Marks | `bold`, `italic`, `underline`, `strike`, `code`, `link`                | Marks are unique per text node; attributes are forbidden except the allow-listed link `href`. |

Raw HTML, scripts, styles, iframes, SVG, forms, tables, arbitrary extension nodes, inline event
handlers, CSS, class names, IDs, and user-controlled media URLs are not allowed. A document is
limited to 500 KB, 5,000 nodes, nesting depth 12, and 200,000 text characters. Media resolution is
performed separately from the Media module using the stored ObjectId; the document never carries a
bucket, object key, signed URL, or external source URL.

## Link rules

- Internal links use a root-relative path beginning with one `/`, or a simple fragment identifier.
- External web links must use HTTPS. HTTP, protocol-relative, credential-bearing, `javascript:`,
  `data:`, `file:`, and other schemes are rejected.
- `mailto:` accepts a plain address without query parameters. `tel:` accepts a bounded phone number.
- User-provided `target` and `rel` attributes are not stored. The renderer opens HTTPS links in a new
  context with `noopener noreferrer`; local, mail, telephone, and fragment links stay in context.

## Trust boundaries

Write paths call `createStoredRichText` (or the equivalent shared validator) before persistence.
Malformed structure, unknown keys, unsupported versions, unsafe links, invalid media references,
cycles, and limit violations are rejected rather than repaired silently.

Read paths call `readStoredRichText`. The `RichContent` renderer performs a second defensive
sanitization and builds semantic React elements directly. It does not use `dangerouslySetInnerHTML`.
Unknown nodes, attributes, marks, and unsafe links are dropped; text that resembles markup remains
escaped text. A media node renders only through an explicit resolver callback that receives its safe
reference DTO.

Pasted or legacy HTML first passes the server-only `sanitizeRichTextImportHtml` allow-list, is then
converted to JSON, validated against this policy, and only then stored. Sanitized HTML is an
interchange value and must never be persisted or rendered directly.

## Migration procedure

1. Add the next integer schema version and a pure `vN -> vN+1` migration.
2. Add fixtures for valid, malformed, adversarial, and already-migrated content.
3. Deploy code capable of reading both versions and writing only the new version.
4. Run an idempotent, checkpointed database migration and record failures without exposing content.
5. After the old version count reaches zero, remove its reader in a later release.

Downgrades and skipped versions are not automatic. Rendering an unsupported or failed migration is
replaced by a safe unavailable-content state and reported with document identifiers only—never the
rich-text body.
