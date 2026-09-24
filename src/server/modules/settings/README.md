# Settings

Owns typed/versioned Homepage, Contact, Social, About, FAQ, Terms, and Language settings. It may consume public APIs from Media, Categories, Dishes, and Blogs to validate configured references. Public projections omit operational secrets.

The seven approved MVP keys live in one singleton registry. Homepage, About, FAQ, and Terms use staged
draft/published revisions; Contact, Social, and Languages publish directly. Every retained revision owns
translated JSON, locale-neutral data, editor provenance, and edit/publication timestamps. Section tasks
add exact payload codecs on top of the bounded safe-JSON envelope.

Stored schema changes use ordered, idempotent migrations and optimistic version replacement. Unknown keys,
future versions, and missing migration steps fail closed. See
[`settings-storage.md`](../../../../../docs/settings-storage.md) for the persistence and migration contract.

Homepage settings add an exact strict codec for hero slides, linked banners, featured dishes, benefits,
testimonials, category banners, discounted dishes, and blog selections. The public reference validator allows
valid unpublished work in drafts but requires ready image media and public, non-archived content at publish
time. See [`homepage-settings.md`](../../../../../docs/homepage-settings.md).

Contact settings add normalized E.164/email/location data, translated address and service-area copy, complete
Lisbon-time business hours, safe optional map data, and an allow-listed locale-aware public projection. The
strict codec cannot store provider credentials. See
[`contact-settings.md`](../../../../../docs/contact-settings.md).

Social settings use finite platform and icon registries, strict platform-aware URL or handle destinations,
translated labels, active state, and unique ordering. The public projection returns sorted safe anchor data,
never executable markup. See [`social-settings.md`](../../../../../docs/social-settings.md).

About settings use staged revisions, versioned sanitized rich-text documents, stable translated item IDs,
bounded kitchen/team/value/story/CTA collections, and Media-boundary validation for explicit and embedded
references. See [`about-settings.md`](../../../../../docs/about-settings.md).

FAQ settings use stable IDs, active state, unique order, canonical English coverage, item-level locale fallback,
immutable add/edit/remove/reorder operations, and an active-only projection for the existing FAQPage SEO
generator. See [`faq-settings.md`](../../../../../docs/faq-settings.md).
