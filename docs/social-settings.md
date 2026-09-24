# Social-media settings

## Stored contract

Social media is a direct-publish settings section with at most 20 links. Each link stores only structured,
bounded data:

- a stable kebab-case ID;
- an allow-listed platform;
- exactly one URL or handle destination;
- an allow-listed icon key;
- an active flag;
- a unique integer display order.

The approved launch platforms are Instagram, Facebook, WhatsApp, Telegram, LinkedIn, YouTube, TikTok, X,
Threads, Pinterest, and Snapchat. The icon registry contains those platform keys plus `external-link`. Icon
keys are identifiers consumed by application-owned MUI icon components; settings cannot contain SVG, HTML,
JavaScript, component names, CSS, or executable templates.

Labels are translated separately from link facts. Canonical English must label every configured link.
Portuguese and Persian may provide partial labels; a missing requested-locale label falls back to canonical
English without changing the selected destination or order.

## Destination safety

Handle destinations use a bounded social-handle syntax. WhatsApp is deliberately stricter and requires an
E.164 telephone number. The public projection expands handles with code-owned HTTPS bases:

| Platform  | Handle destination pattern              |
| --------- | --------------------------------------- |
| Instagram | `https://www.instagram.com/{handle}`    |
| Facebook  | `https://www.facebook.com/{handle}`     |
| WhatsApp  | `https://wa.me/{digits}`                |
| Telegram  | `https://t.me/{handle}`                 |
| LinkedIn  | `https://www.linkedin.com/in/{handle}`  |
| YouTube   | `https://www.youtube.com/@{handle}`     |
| TikTok    | `https://www.tiktok.com/@{handle}`      |
| X         | `https://x.com/{handle}`                |
| Threads   | `https://www.threads.net/@{handle}`     |
| Pinterest | `https://www.pinterest.com/{handle}`    |
| Snapchat  | `https://www.snapchat.com/add/{handle}` |

Direct URLs must use HTTPS, contain no username/password, match an exact host allow-list for their selected
platform, and contain no API-key, access-token, token, secret, or signature query parameter. Consequently,
`javascript:`, `data:`, protocol-relative URLs, deceptive third-party hosts, and platform/host mismatches fail
before persistence.

## Public projection and rendering

`projectPublicSocialSettings` returns only active links, sorted by the unique stored order. Each result contains
the platform, localized label, generated/validated HTTPS `href`, known icon key, order, fixed `_blank` target,
and fixed `noopener noreferrer` relationship. The UI maps `iconKey` through a compile-time component registry
and renders a normal anchor; it must never interpret settings as markup.

Inactive links remain available to administrators but cannot reach the public projection. Stable IDs,
destination source details, and the active flag are omitted from the public result. The renderer therefore
receives the minimum data required for an accessible external link.

## Verification

- Unit tests cover the platform/icon registry, URL and handle variants, unsafe protocols, mismatched hosts,
  credentials, sensitive parameters, platform-specific handles, markup attempts, duplicate identity/order,
  canonical labels, locale fallback, active filtering, stable ordering, and generated anchor attributes.
- MongoDB integration coverage proves parsed social settings persist as one direct published revision with no
  draft.
