# Contact-information settings

## Stored contract

Contact information is a direct-publish settings section because the storefront, checkout support, SEO, and
customer communication surfaces need one authoritative operational snapshot. A parsed payload separates
locale-neutral facts from visitor-facing translations.

Locale-neutral data contains:

- one to eight unique phone records with stable IDs, E.164 numbers, mobile/landline kind, exactly one primary
  number, and an explicit public flag;
- an E.164 WhatsApp number and enabled flag;
- one normalized lowercase contact email;
- ISO two-letter country code and postal code;
- WGS84 latitude/longitude, bounded to `-90..90` and `-180..180` respectively;
- city or radius service-area mode, with a radius required only for radius mode;
- all seven weekdays exactly once, with zero to three ordered, non-overlapping same-day opening periods;
- the fixed `Europe/Lisbon` business timezone;
- optional Leaflet or Google Maps Embed presentation data.

Translations contain labels for configured phones, the complete postal address text, service-area name and
description, business-hours note, WhatsApp prefilled message, and accessible map label. English is canonical
and must label every configured phone. Portuguese and Persian can be added independently and may omit labels
for non-public/secondary numbers while the projection uses the canonical label fallback.

The launch service area is represented as city mode with translated “Porto city” copy and no artificial
radius. The actual delivery-price distance rules remain part of checkout/order settings rather than contact
presentation data.

## Map and secret policy

Leaflet uses the stored coordinates and zoom and cannot carry an embed URL. Google embed mode accepts only
credential-free HTTPS URLs on `google.com/maps/embed`. Directions links may use any credential-free HTTPS
destination. Userinfo and query parameters named like API keys, access tokens, tokens, secrets, or signatures
are rejected. Provider API keys, tile credentials, signing secrets, and environment-specific endpoints belong
in the deployment secret store and cannot be represented by this strict schema.

This intentionally supports public embed payloads while preventing the settings collection from becoming a
credential store.

## Public projection

`projectPublicContactSettings` is an explicit allow-list rather than a serialization of the stored revision.
It resolves requested locale, optional configured fallback, then canonical English and returns only:

- phones marked public, with localized labels;
- enabled WhatsApp details, otherwise `null`;
- normalized email and translated address;
- coordinates, service-area presentation, weekly hours, and Lisbon timezone;
- safe map provider, URLs, zoom, and localized accessible label.

Stable phone IDs and the `public` control are omitted. Unknown/provider credential fields cannot enter a parsed
payload and therefore cannot leak through the projection. This projection is suitable for public page and SEO
consumers; management APIs must use an authorized internal representation.

## Verification

- Unit tests cover normalization, E.164/email/coordinate bounds, exactly one primary phone, complete weekdays,
  overlapping hours, service-area modes, map/provider rules, embedded secret rejection, canonical labels,
  localized projection, private-phone removal, fallback, and disabled WhatsApp behavior.
- MongoDB integration coverage proves the parsed payload persists only in the direct published revision and
  retains geographic/timezone data.
- Strict TypeScript, ESLint, formatting, and the complete project verification gate protect the contract.
