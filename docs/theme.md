# Global MUI theme

`src/theme/app-theme.ts` is the executable mapping from the approved tokens in
`src/theme/tokens.ts` to MUI. `/theme-showcase` is the internal visual reference; it is excluded
from search indexing and exercises the same theme used by the product.

## Foundation mapping

| MUI concern | Token source       | Applied behavior                                                                               |
| ----------- | ------------------ | ---------------------------------------------------------------------------------------------- |
| Palette     | `colorTokens`      | Brand coral and saffron plus accessible light/dark surfaces, text, dividers, and status colors |
| Typography  | `typographyTokens` | Optimized Plus Jakarta Sans/Vazirmatn stack, semantic weights, and responsive headings         |
| Spacing     | `spacingTokens.xs` | A 4 px MUI spacing unit; component and page values remain on the approved scale                |
| Breakpoints | `breakpointTokens` | `xs=0`, `sm=640`, `md=768`, `lg=1024`, `xl=1280`                                               |
| Shape       | `radiusTokens`     | 12 px control default, 16 px cards, 24 px dialogs, and pill chips                              |
| Elevation   | `shadowTokens`     | Subtle, card, raised, floating, and dialog tiers in the MUI shadow array                       |
| Motion      | `motionTokens`     | 200/300/500 ms durations, approved easing, and restrained pressed states                       |

## Global component contract

Buttons, links, icon buttons, paper, cards, badges, chips, text fields, outlined inputs, alerts,
dialogs, drawers, skeletons, pagination, app bars, tables, tabs, tooltips, and snackbars have shared
defaults or overrides. Overrides stay in the theme when they represent a system-wide rule; page-only
composition stays in the page `sx` props. Existing MUI variants are restyled rather than extended
with one-off product variants. Application-level contracts are documented in
[`ui-primitives.md`](./ui-primitives.md).

The theme uses MUI CSS variables with the `--sara` prefix and class-based `light`/`dark` schemes.
The root layout runs `InitColorSchemeScript` before content and the provider uses the matching
`sara-kitchen-mode` browser-storage key. The first visit is light; subsequent mode choices persist
without a server-render flicker.

LTR and RTL use separate theme instances with identical design tokens and an explicit
`theme.direction`. Application layout uses logical CSS properties; generated RTL CSS is processed by
the direction-specific Emotion cache documented in [`right-to-left.md`](./right-to-left.md).

## Verification matrix

Playwright verifies the showcase at 390, 700, 900, and 1440 px in both light and dark schemes. The
checks cover responsive heading sizes, mobile-card versus table behavior, core colors, card shape,
horizontal overflow, runtime rendering, and automated accessibility. Each test run attaches a
full-page screenshot to the Playwright report for human review without committing generated images.

Run the focused checks with:

```powershell
pnpm test:unit -- tests/unit/mui-theme.test.ts tests/component/theme-showcase.test.tsx
pnpm test:e2e -- tests/e2e/theme-showcase.spec.ts
```
