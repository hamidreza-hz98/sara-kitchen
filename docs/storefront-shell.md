# Storefront shell

The storefront shell is the shared public frame for Sara Kitchen routes. It lives in the
`[locale]/(storefront)` route group so public pages inherit it without wrapping the internal theme
showcase or future dashboard layouts.

## Design mapping

The implementation is traced to the supplied Stitch export at
`stitch_sara_kitchen_homepage/layout`:

- `sara_kitchen_homepage/screen.png` and `code.html` define the sticky translucent header, compact
  language control, coral active state, floating-center mobile cart, pill bottom navigation,
  centered brand story, link groups, and generous footer spacing.
- `opened_menu_state/screen.png` and `code.html` define the end-side drawer, dimmed backdrop, large
  touch targets, active navigation treatment, header/description, and close behavior.
- `Logo.png` from the approved Sara Kitchen source assets supplies the local optimized brand mark.

The source export is mobile-first. At the `lg` token (1024px), the same information architecture
becomes a centered desktop navigation row with language, cart, and account controls at the logical
end. The drawer and floating bottom navigation disappear. This extension uses existing design
tokens rather than introducing a second desktop visual language.

## Structure and behavior

- `StorefrontShell` owns the first-focusable skip link, `main-content` landmark, header, footer, and
  mobile navigation. It accepts a cart count; zero remains visible and accessible until cart state is
  introduced.
- `StorefrontHeader` renders the brand, desktop primary navigation, locale selector, cart, account
  menu, and the mobile drawer trigger.
- `StorefrontMobileNavigation` presents Home, Menu, Cart, Blog, and Profile in the supplied floating
  pattern. It uses logical positioning so order and placement follow document direction.
- `StorefrontFooter` renders localized brand copy, quick links, menu categories, legal navigation,
  and the current build year.

Active links use `aria-current="page"`. Every navigation region is named. Icon-only controls have
localized accessible labels. The mobile drawer traps focus, closes with Escape/backdrop/close button,
and restores the trigger. The skip target has `tabIndex=-1` so keyboard users land on the content
region rather than merely scrolling it into view.

## Locale policy

The selector writes the existing first-party `SARA_LOCALE` cookie with the established one-year,
SameSite=Lax policy and reloads the current clean pathname. It never adds a locale segment. The
server validates the value and applies English, European Portuguese, or Persian direction/messages
on the next response.

## Responsive acceptance

Playwright exercises phone (390px), tablet (768px), desktop (1024px), and wide (1440px) widths. It
checks the correct navigation mode, cart access, landmarks, footer, overflow, screenshots, skip-link
focus, account menu keyboard behavior, drawer focus restoration, clean-URL locale switching, Persian
drawer mirroring, and axe results.
