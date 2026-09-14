# Theme

Sara Kitchen design tokens and Material UI theme configuration belong here.

- Keep palette, typography, spacing, breakpoints, radii, shadows, and motion as typed tokens.
- Keep reusable MUI component variants and overrides in focused files.
- Support English and Portuguese LTR plus Persian RTL without duplicating the whole theme.
- Prefer logical CSS properties for direction-aware layout.
- Treat the approved UI/UX and brand assets as the visual source of truth while preserving accessibility and responsive behavior.

The framework-neutral values are exported from [`tokens.ts`](./tokens.ts). Their source evidence,
normalization decisions, and accessibility derivations are recorded in
[`docs/design-tokens.md`](../../docs/design-tokens.md). MUI adaptation remains the responsibility of
the component-override task; components must not import raw values from the Stitch exports.

The App Router integration consists of:

- `fonts.server.ts`, which self-hosts the Latin and Persian fonts through `next/font`;
- `emotion-cache.ts`, which defines the stable cache key and MUI cascade layer;
- `app-theme.ts`, the client-side MUI theme factory and font-variable bridge; and
- `AppThemeProvider` in `src/providers`, nested under MUI's streaming cache provider by the root
  layout.

See [`docs/mui-app-router.md`](../../docs/mui-app-router.md) for provider order and SSR acceptance.
