# SEO administration controls

## Management surfaces

Authorized administrators can manage SEO from two complementary surfaces:

- Category, Dish, and Blog create/edit forms embed the shared `EntitySeoPanel`. Before the entity is
  first saved it presents the generated search/social preview and explains that the SEO record will be
  created with the entity. Existing entities load their persisted SEO record and allow each localized
  field to be switched independently between automatic and manual ownership.
- `/dashboard/seo` manages the approved static-page registry (`home`, `menu`, `about`, `contact`,
  `blog`, `faq`, and `terms`). Static metadata is always manual-owned; an administrator cannot create
  an arbitrary route from this screen.

The dashboard navigation requires `seo:read`. Entity mutations require `seo:update`; static creation
and update require `seo:create` and `seo:update` respectively. Read-only administrators can inspect the
same values and previews without receiving editable controls.

## Ownership and fallback behavior

Automatic fields follow their Category, Dish, or Blog source. The UI disables their input, labels them
`Automatic`, and states that the generated entity fallback is active. Turning on a field's manual switch
stores that value and adds only that field to `manualOverrides`; later entity edits preserve it. Turning
the switch off removes its ownership marker and immediately reruns the automatic synchronizer so the
current generated value is visible without waiting for another entity edit.

Ownership is per locale and per field for search title, search description, keywords, Open Graph title
and description, and Twitter title and description. Canonical URL ownership is global because locale is
stored in the browser and does not alter Sara Kitchen's public paths. A status chip distinguishes fully
automatic records from records containing manual overrides.

## Guidance and previews

The shared controls show current and maximum character counts beside every text field. The model and API
enforce the same limits: search title 70, search description 170, social title 100, and social description
220 characters. Keywords are comma-separated in the UI and become at most 20 unique values of at most 60
characters each at the API boundary.

The social-card preview uses the selected locale and falls back from Open Graph copy to search copy. Until
a dedicated share image is selected it displays an explicit image fallback state. The preview is guidance,
not a promise that every social platform will render an identical crop.

## Static-page workflow

The static manager loads all existing records once a page is selected, displays whether the record exists,
and uses the same localized search/social controls. It also manages the share image, indexing, link-follow,
and active switches. Create and save actions use the protected static SEO API, preserve the selected route,
produce audit records, and invalidate only SEO cache tags.

## Verification

- Component tests cover automatic labels, fallback messaging, character guidance, social preview, and
  independent manual ownership.
- Schema tests reject missing manual values, duplicate locales/keywords, and unsafe canonical URLs.
- MongoDB integration coverage proves manual changes preserve automatic fields and reset ownership cleanly.
- Locale-catalog checks require the complete controls vocabulary in English, Portuguese, and Persian.
