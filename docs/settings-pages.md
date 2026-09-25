# Settings dashboard pages

SK-0124 exposes one registry-driven dashboard surface at
`/dashboard/settings/[section]`. The registry is the only source of valid page segments and contains
homepage, contact, social, about, FAQ, terms, and languages. Any other segment calls Next.js
`notFound()` before authentication or database work.

## Editing model

- Every section has English, Portuguese, and Persian tabs. English is canonical; optional locale
  content can be omitted and resolved through the configured fallback chain.
- Homepage and About integrate the reusable media picker. Contact exposes high-frequency email and
  coordinate controls, FAQ and Social provide safe item creation, Languages provides visibility
  selectors, and Terms exposes policy type/version/effective-date controls.
- Complete schema data remains available in an advanced structured editor. Exact server schemas are
  authoritative, reject unknown fields, and return field-safe validation errors.
- The locale preview is derived from the current unsaved form and never reads private projections.
- Dirty forms install both `beforeunload` and internal-link interception. Save, validation, network,
  conflict, permission, draft, and publication states remain visible and recoverable.

## Publication and authorization

Contact, Social, and Languages publish directly. Homepage, About, and FAQ save drafts and require an
explicit publication request. Terms creates immutable policy-version drafts and releases the selected
version through the dedicated consent-safe lifecycle.

The page requires `settings:read`; update actions are additionally enforced by the service and Route
Handler using `settings:update-content`, `settings:update-operations`, or
`settings:update-security`. UI hiding/disablement is only a convenience and never the authorization
boundary. All mutations use the admin CSRF/origin contract, generate audit records, and trigger exact
settings plus SEO cache revalidation only when public data changes.

## Accessibility and responsive behavior

Native tab semantics, associated labels, alert roles, keyboard-operable MUI controls, responsive
stacks/grids, logical spacing, and locale direction inherited from the application shell keep the
editor usable at mobile through desktop breakpoints and in Persian RTL mode.
