# Public About page (SK-0169)

`/about` reads only the **published** About settings revision. Draft edits remain private until publication. The page uses the locale selected by the existing browser cookie (`en`, `pt-PT`, or `fa`), without a visible locale URL prefix. Page metadata and structured data follow the existing static-page SEO record, with localized content as a fallback.

The public projection orders and filters enabled values, story sections, team members, and calls to action. When a Portuguese or Persian entry omits an item, its canonical English item is used; language-neutral links, ordering, visibility, and media IDs remain outside translations. The versioned rich-text document is sanitized for rendering. Embedded images and videos are resolved through the Media module; missing/unready assets do not block text.

Hero, kitchen gallery, story imagery, portraits, and value icons resolve through the Media module. A missing hero uses the first available kitchen image or a decorative brand placeholder. Other missing imagery uses the same decorative placeholder or collapses the optional image, preserving the surrounding text. The no-published-settings state shows localized, factual introductory copy, a brand visual, and a menu link; it does not invent values, team biographies, or photographs. Published settings with no calls to action render none.

The layout follows the supplied About screen's coral story heading, soft blush hero, rounded imagery, white story panels, and values section, extending it to desktop and RTL. The shared storefront shell owns the single `main` landmark and skip link. About content uses semantic headings and text-only sanitized rich content; media alt text comes from the localized settings or Media metadata.

The content cache is bounded to 60 seconds and tagged `settings:about`; publication invalidates this tag. Signed media URLs outlive the page cache. Tests cover locale fallback, missing media, configured content, all three mobile locales, horizontal overflow, and automated accessibility.
