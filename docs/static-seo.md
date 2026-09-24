# Static-page SEO management

## Scope

Static SEO targets come from `STATIC_SEO_PAGES`; administrators cannot submit arbitrary paths. This
keeps route ownership in code and prevents metadata records for misspelled, internal, or sensitive
pages.

| Key       | Path       | Purpose             |
| --------- | ---------- | ------------------- |
| `home`    | `/`        | Storefront homepage |
| `menu`    | `/menu`    | Menu index          |
| `about`   | `/about`   | About Sara Kitchen  |
| `contact` | `/contact` | Contact page        |
| `blog`    | `/blog`    | Blog index          |
| `faq`     | `/faq`     | FAQ page            |
| `terms`   | `/terms`   | Terms page          |

The authentication, forgot/reset-password, login, signup, dashboard, profile, cart, and payment-result
route families are explicitly excluded. These pages must use `noindex` metadata defined by their page
implementation and cannot be added through static SEO administration.

## Management contract

- `GET /api/seo/static` requires `seo:read` and lists existing static records.
- `POST /api/seo/static` requires `seo:create`, an approved key, origin/CSRF protection, and at least
  the canonical English translation.
- `GET /api/seo/static/:staticPageKey` requires `seo:read`.
- `PATCH /api/seo/static/:staticPageKey` requires `seo:update` plus origin/CSRF protection. The key,
  path, and slug are immutable.

The service validates translated title, description, keywords and social copy; robots directives;
canonical URL; Twitter/Open Graph settings; bounded structured-data inputs; and an optional ready image
from Media. Every create/update is audited and invalidates only SEO content tags.

## Uniqueness and concurrency

Each approved key maps to exactly one route. Registry startup checks reject duplicate or excluded
paths. MongoDB unique partial indexes protect the active target key and normalized path, while the
service performs a readable preflight conflict check. Updates use Mongoose versioning; stale writers
receive a conflict instead of silently replacing newer edits.

All fields entered through this workflow are marked manually managed. Automatic entity SEO does not
own static records and cannot overwrite these values.
