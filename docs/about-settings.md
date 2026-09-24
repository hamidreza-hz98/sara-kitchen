# About settings

The `about` settings section is staged: editors can save a draft, validate it, preview it, and publish a later revision without changing the live page prematurely.

## Content model

Language-neutral data stores only presentation structure and references:

- optional hero image and an ordered kitchen gallery;
- ordered team members with image references;
- ordered values with optional image icons;
- ordered story sections with optional image and intentional media placement;
- up to three optional calls to action with a safe destination, style, and active state.

Stable kebab-case IDs join each structural item to its translated value. Canonical English must cover every configured item. Portuguese and Persian may be partial so canonical fallback can fill missing items.

Translated content contains the page title, summary, main rich document, accessible media text, team copy, values, story documents, and call-to-action labels. Non-language facts—including media IDs, links, order, visibility, and layout—never appear in translations.

## Rich-content boundary

Main and story content use the versioned structured format in [rich-text-policy.md](./rich-text-policy.md). Strict write validation rejects unknown nodes, attributes, marks, unsafe links, malformed media embeds, oversized documents, and raw HTML/script payloads. Public rendering applies the same defensive sanitizer again. Arbitrary HTML is never persisted or interpreted.

Call-to-action destinations may be public site-relative paths or credential-free HTTPS URLs. Dashboard and API paths, protocol-relative URLs, backslash tricks, and executable protocols are rejected.

## Media references

Before saving or publishing, `validateAboutSettingsMediaReferences` resolves references exclusively through the Media module public API. Validation covers:

- hero, kitchen, portrait, value-icon, and story images;
- image and video nodes embedded in every locale's main/story rich content;
- missing or recycled media;
- expected versus actual media kind;
- processing state—only `ready` media is accepted.

Validation issues contain the safe settings path, reference ID, expected kind, optional actual kind, and stable error code. The Settings module never reads the Media model directly.

## Limits

| Collection      | Maximum |
| --------------- | ------: |
| Kitchen media   |      12 |
| Team members    |      20 |
| Values          |      12 |
| Story sections  |      12 |
| Calls to action |       3 |

IDs and order values are unique within each ordered collection. These bounds keep settings documents, administrative forms, and public rendering predictable.
