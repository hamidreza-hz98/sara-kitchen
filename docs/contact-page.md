# Public Contact page (SK-0170)

`/contact` reads only the published contact-information and social-media settings. Phone, email, WhatsApp, social links, address, service area, business hours, and map are omitted rather than invented when not configured. The page and form are translated in English, Portuguese, and Persian; static-page SEO controls override localized fallback metadata when configured.

The map uses the settings-approved provider. Leaflet settings render a coordinate-derived OpenStreetMap iframe with provider attribution and a directions link; Google Maps settings render only an allow-listed HTTPS embed URL with attribution. CSP permits these exact frame origins. No coordinates, credentials, or arbitrary embed markup come from form submissions.

The enhanced form sends JSON to the existing `POST /api/contact-submissions` flow. Native constraints cover required name/message, length, email syntax, and consent; a phone **or** email is required. Server-side Zod validation, a honeypot, the shared same-origin check, Mongo-backed rate limit, and duplicate/spam scoring remain authoritative. The form records the fixed `contact-message-notice-v1` consent version, which corresponds to the three translated contact-data notices; bump this version if that notice changes materially. Consent is only for responding to the enquiry, not marketing.

With JavaScript disabled, Next.js's global streaming loading shell provides a link to the basic HTML form at `/api/contact-submissions/form`. Its bounded native POST uses the same domain validation, origin policy, rate limit, and contact flow, then returns a localized standalone HTML result with no submitted PII. This HTML endpoint is the explicit non-JSON Route Handler contract exception. The fallback page has no indexable content, and the native form keeps feedback accessible without scripts.

The Contact page caches public settings for at most 60 seconds under the contact/social setting tags. Tests cover three mobile locales, missing and populated settings, map attribution, native no-script validation, enhanced submission feedback, forged-origin rejection, accessibility, and shared origin/route-contract rules.
