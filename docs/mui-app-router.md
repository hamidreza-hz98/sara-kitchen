# MUI App Router integration

Sara Kitchen uses the official Material UI adapter for the installed Next.js 16 App Router. The
integration preserves the root layout as a Server Component while creating the smallest practical
client boundary for theme context.

## Provider order

The root layout renders this order inside `<body>`:

```text
AppRouterCacheProvider (@mui/material-nextjs/v16-appRouter)
└── AppThemeProvider (client boundary)
    ├── ThemeProvider
    ├── CssBaseline
    └── server-rendered route children
```

`AppRouterCacheProvider` creates one Emotion cache for its mounted tree, tracks styles emitted during
streaming, and inserts flushed style tags into `<head>`. Its options are centralized in
`src/theme/emotion-cache.ts`:

- cache key: `sara-mui`, unique and stable across server and browser rendering;
- `enableCssLayer: true`, which wraps generated rules in `@layer mui`; and
- no manually created second cache or nested Emotion `CacheProvider`.

The root `<html>` uses the narrow `suppressHydrationWarning` exception required by MUI's
`InitColorSchemeScript`, because that script sets the selected color-scheme class before React
hydrates. Application mismatches remain visible and fail the browser acceptance test; the exception
is not used on application content.

## Cascade-layer strategy

`src/app/globals.css` declares this order before any rules:

```css
@layer theme, base, mui, components, utilities;
```

- `theme` is reserved for future design-variable declarations.
- `base` contains the minimal document reset and font/background fallbacks.
- `mui` contains Emotion output from the official cache provider.
- `components` is reserved for shared application components.
- `utilities` is the final named layer for deliberately strongest helpers.

Existing CSS Modules are unlayered and therefore can deliberately override layered MUI component
styles. New global rules must enter a named layer; do not add an anonymous global cascade that makes
precedence accidental.

## Font integration

`src/theme/fonts.server.ts` uses `next/font/local` with repository-owned, licensed variable WOFF2
files. Next.js emits optimized same-origin assets and the browser never requests a font host.

- Plus Jakarta Sans supplies Latin and Latin Extended for English and Portuguese.
- Vazirmatn supplies Arabic-script glyphs for Farsi and is not preloaded on the default English
  document.
- Both expose CSS variables on `<html>` with `display: swap`, adjusted metric fallbacks, and explicit
  system fallbacks. `:lang(fa)` selects Vazirmatn as the active face for Persian fragments.
- The MUI theme and base CSS use the same variable order, preventing a server/client font-family
  disagreement.
- The variable names are literal strings at each `next/font` loader call because Next.js statically
  analyzes font options at build time; the identical public names are exported for theme consumers.

Locale-specific `lang` and `dir` selection belongs to the localization tasks. The current root is
truthfully `lang="en" dir="ltr"`; it does not guess a browser-only locale during SSR.

## Theme boundary

`src/theme/app-theme.ts` is explicitly a Client Component module because MUI's created theme contains
non-serializable functions. The theme object is created inside the client module graph and is never
passed from a Server Component. Route children remain server-rendered and are passed through the
provider as React-rendered children.

This task configures CSS variables and typography only. Palette, shape, shadows, component variants,
and detailed light/dark behavior are implemented in SK-0025 from the approved design tokens.

## Acceptance checks

The browser suite verifies the integration against a real Next.js server:

1. the raw server response already contains `sara-mui` Emotion styles inside `<head>`;
2. generated MUI rules are wrapped in `@layer mui`, preventing an unstyled first response;
3. no Emotion style tag is emitted inside `<body>`;
4. serialized Emotion identifiers are unique after hydration and remain stable after reload; and
5. the browser emits no hydration, server/client mismatch, Emotion, or page errors.

Unit tests separately lock the cache options, font-variable contract, and MUI theme font family.

## References

- [Material UI Next.js integration](https://mui.com/material-ui/integrations/nextjs/)
- [Material UI CSS layers](https://mui.com/material-ui/customization/css-layers/)
- [Next.js font optimization](https://nextjs.org/docs/app/getting-started/fonts)
- [Next.js CSS-in-JS guidance](https://nextjs.org/docs/app/guides/css-in-js)
- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
