# Local fonts

Sara Kitchen self-hosts two variable fonts through `next/font/local`:

| Script                 | Primary family    | Weight range | Runtime fallbacks                                      |
| ---------------------- | ----------------- | ------------ | ------------------------------------------------------ |
| English and Portuguese | Plus Jakarta Sans | 200–800      | adjusted Arial, system UI, Segoe UI, Arial, sans-serif |
| Farsi/Persian          | Vazirmatn         | 100–900      | adjusted Arial, Tahoma, Segoe UI, Arial, sans-serif    |

The binaries, pinned upstream revisions, SHA-256 checksums, and unmodified SIL OFL 1.1 texts live in
`src/theme/fonts`. Builds therefore make no font-host network request and do not depend on Google
Fonts availability.

## Loading and script selection

`src/theme/fonts.server.ts` is the single loader definition. Both variable WOFF2 files use
`display: swap`, explicit weight ranges, preloading, and Next.js's Arial metric adjustment. The root
layout applies their generated variables once, so every route gets the same server/client contract.

The global `--font-sara-active` custom property defaults to Plus Jakarta Sans. Any element carrying
`lang="fa"` inherits Vazirmatn as its active family through `:lang(fa)`, including MUI typography.
This lets translated fragments render correctly before whole-document locale switching is added.
Future localization work must set both `lang="fa"` and `dir="rtl"` at the correct document or
section boundary.

Both files are currently preloaded because the application can switch language without a locale
path and the server does not yet have a persisted locale contract. Revisit conditional preloading
when localization establishes a server-readable language preference.

## Acceptance evidence

- Unit tests pin both binaries by checksum, verify both license texts, and prohibit regression to
  `next/font/google`.
- The browser test renders real connected Persian text, verifies the resolved active family is the
  loaded Vazirmatn face, captures the glyph sample, and confirms every font request is same-origin.
- A buffered Layout Instability observer starts before navigation and reports cumulative layout
  shift only after `document.fonts.ready` and two animation frames. The accepted result is exactly
  zero on the deterministic showcase route.
