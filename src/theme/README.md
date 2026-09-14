# Theme

Sara Kitchen design tokens and Material UI theme configuration belong here.

- Keep palette, typography, spacing, breakpoints, radii, shadows, and motion as typed tokens.
- Keep reusable MUI component variants and overrides in focused files.
- Support English and Portuguese LTR plus Persian RTL without duplicating the whole theme.
- Prefer logical CSS properties for direction-aware layout.
- Treat the approved UI/UX and brand assets as the visual source of truth while preserving accessibility and responsive behavior.

The MUI App Router cache/provider integration will be added in the dedicated theme tasks.

The framework-neutral values are exported from [`tokens.ts`](./tokens.ts). Their source evidence,
normalization decisions, and accessibility derivations are recorded in
[`docs/design-tokens.md`](../../docs/design-tokens.md). MUI adaptation remains the responsibility of
the next theme task; components must not import raw values from the Stitch exports.
