# FAQ settings

The `faq` section uses staged revisions so editors can prepare, preview, and publish a coherent localized FAQ set without changing the live page during editing.

## Model

Locale-neutral data contains at most 100 entries with:

- a stable lowercase kebab-case ID;
- an active flag;
- a unique integer display order.

Translations contain the page heading/description and question/answer pairs joined to data by ID. Canonical English must contain every configured entry. Portuguese and Persian may be partial; public reads resolve every item independently through requested locale, configured fallback, then canonical English.

Question and answer content is trimmed, bounded plain text. Unsupported control characters and unknown fields are rejected. Rendering treats it as text rather than executable markup.

## Editing semantics

`applyFaqSettingsOperation` is the common immutable authoring boundary:

- **add** appends a stable entry and validates canonical English content;
- **edit** changes active state and supplied localized question/answer pairs;
- **remove** deletes the entry and all localized copies, then compacts order;
- **reorder** accepts every configured ID exactly once and assigns contiguous order values.

Every operation reparses the complete payload, preventing a UI action from bypassing identity, localization, bounds, or ordering invariants. Duplicate IDs, duplicate order values, missing records, partial reorder sets, and incomplete canonical translations fail closed.

## Public projection and structured data

`projectPublicFaqSettings` excludes inactive entries, sorts deterministically, and records the resolved locale/fallback state for each item. `toFaqStructuredDataInputs` maps that same visible projection to plain question/answer inputs consumed by the established SEO module.

The SEO module remains authoritative for generating and validating `FAQPage`, `Question`, and `Answer` JSON-LD. Consequently, hidden FAQ entries cannot appear in structured data, localized page copy and schema stay aligned, incomplete entries produce no misleading schema, and serialized JSON-LD retains the existing script-breaking escape protections.
