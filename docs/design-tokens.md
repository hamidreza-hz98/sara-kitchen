# Design tokens

This document is the traceability record for `src/theme/tokens.ts`. It converts the supplied Stitch
screens into one framework-neutral, typed visual language. The exports are evidence, not executable
requirements: generated copy, links, remote assets, and embedded comments were not treated as
project instructions.

## Source inventory

The supplied root is
`C:/Users/NoteBook/Downloads/stitch_sara_kitchen_homepage`. It contains 45 HTML exports and 46 PNG
screens across 17 requested areas. Paths below are relative to that root.

| ID  | Design evidence                                                                                                                                                                                                          | Used for                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| S01 | `layout/sara_kitchen_homepage/{code.html,screen.png}`                                                                                                                                                                    | Dominant customer palette, typography, mobile density, cards, navigation |
| S02 | `dashboard/management_dashboard_light_mode_detailed/{code.html,screen.png}` and `dashboard/management_dashboard_light_mode/{code.html,screen.png}`                                                                       | Harmonized desktop admin density, surfaces, charts, tables, statuses     |
| S03 | `menu/menu_grid_view_harmonized/`, `menu/menu_list_view_harmonized/`, `menu/menu_grid_view/`, and `menu/menu_list_view/`                                                                                                 | Responsive grid/list behavior and breakpoint use                         |
| S04 | `dish details/dish_details_ghormeh_sabzi/`, `cart/shopping_cart_step_1/`, `cart/shopping_cart_step_2/`, and `customer profile/`                                                                                          | Commerce hierarchy, mobile spacing, prices, controls, profile layouts    |
| S05 | `layout/opened_menu_state/`, `layout/notification_snackbars/`, `address management/create_edit_address_modal/`, `customer profile/login_dialog/`, and `customer profile/signup_dialog/`                                  | Overlays, feedback, focus, elevation, modal and transition behavior      |
| S06 | `about/`, `contact/`, `blog/blog_main_page/`, and `blog/blog_post_detail/`                                                                                                                                               | Editorial scale, brand accents, long-form rhythm                         |
| S07 | The 11 blue/Inter admin exports: dark variants under `activity logs/`, `adminsitrator login/`, `categories management/`, `contact - management/`, `dashboard/`, `dish - modify - management/`, and `media - management/` | Dark-mode contrast and component-state evidence only                     |
| S08 | `contact/code.html`, `blog/blog_post_detail/code.html`, `cart/shopping_cart_step_2/code.html`, and `customer profile/customer_profile/code.html`                                                                         | Exact cream `#FFD48D`, navy `#2C2C47`, and muted-text values             |
| S09 | All 45 `code.html` files, surveyed as a set                                                                                                                                                                              | Frequency-based spacing, radius, type, breakpoint, shadow, motion tokens |
| S10 | `payment/payment_success/`, `payment/payment_failed/`, `layout/notification_snackbars/`, and admin dashboard/order status presentations                                                                                  | Success, warning, error, and information semantics                       |
| S11 | `cart/shopping_cart_step_3_finalize_order/`, the 11 S07 exports, `activity logs/activity_logs_light_mode/`, and `contact - management/contact_submission_detail_light_mode/`                                             | Variant reconciliation; not direct brand-token sources                   |

Directories in S03–S11 contain the supplied `code.html` and `screen.png` pairs unless an individual
file is named. `layout/logo.png/screen.png` is the one image-only export and corroborates the coral,
cream, and navy brand family.

## Reconciliation decisions

The generated screens contain three competing themes. The accepted theme follows the dominant,
brand-aligned family:

| Export family                 | Count | Extracted core                                     | Decision                                                                                       |
| ----------------------------- | ----: | -------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Brand/harmonized              |    31 | `#FF6161`, `#F8F5F5`, `#230F0F`, Plus Jakarta Sans | Accepted as the product and administration foundation.                                         |
| Blue admin drafts             |    11 | `#135BEC`, `#F6F6F8`, `#101622`, Inter             | Not a second theme; only layout, dark contrast, and state patterns are retained.               |
| Near-brand light admin drafts |     2 | `#FF6060`, `#F8F5F5`, Inter                        | Normalized to the accepted coral and typeface.                                                 |
| Finalize-order outlier        |     1 | `#EC5B13`, `#F8F6F6`, `#221610`, Public Sans       | Layout intent retained; orange/brown palette and font rejected as inconsistent with the brand. |

The exact coral remains the main brand swatch. It is not used for normal coral text on white because
that pairing is below the project's AA contrast target. `primaryText` is a darker derived coral for
links/text; `onPrimary` uses the supplied navy on coral. Token tests enforce at least 4.5:1 for those
normal-text combinations.

## Color source map

Derived colors are deliberately labeled. They preserve the source hue while supplying accessible
text or predictable light/dark elevation states.

| Token                                    | Value     | Source and derivation                                                                  |
| ---------------------------------------- | --------- | -------------------------------------------------------------------------------------- |
| `designTokens.color.brand.primary`       | `#FF6161` | S01/S02; exact primary in 31 HTML exports                                              |
| `designTokens.color.brand.primaryText`   | `#C93643` | S01 primary, darkened for normal text on a light surface                               |
| `designTokens.color.brand.onPrimary`     | `#2C2C47` | S08 exact navy; accessible foreground on the exact coral                               |
| `designTokens.color.brand.accent`        | `#FFD48D` | S08 exact secondary and the supplied logo's cream                                      |
| `designTokens.color.brand.ink`           | `#2C2C47` | S08 exact `text-main`/`accent-dark`                                                    |
| `designTokens.color.light.canvas`        | `#F8F5F5` | S01–S06; exact background in 33 configs and 44 total declarations                      |
| `designTokens.color.light.surface`       | `#FFFFFF` | S01–S06; white cards, navigation, forms, dialogs, and glass bases                      |
| `designTokens.color.light.surfaceMuted`  | `#FFF1F1` | S01/S02/S04; normalized coral-tinted sections and controls                             |
| `designTokens.color.light.textPrimary`   | `#2C2C47` | S08 exact brand text                                                                   |
| `designTokens.color.light.textSecondary` | `#64748B` | S01–S06; normalized repeated Slate 500 text utilities                                  |
| `designTokens.color.light.divider`       | `#E8DEDE` | S01/S02/S05; normalized warm borders and primary-at-low-opacity rules                  |
| `designTokens.color.dark.canvas`         | `#230F0F` | S01–S06; exact configured dark background in 33 exports                                |
| `designTokens.color.dark.surface`        | `#321B1B` | S01/S05/S07; derived first warm elevation over the accepted dark canvas                |
| `designTokens.color.dark.surfaceMuted`   | `#432424` | S01/S05/S07; derived second warm elevation for selected/raised regions                 |
| `designTokens.color.dark.textPrimary`    | `#FFF9F7` | S01/S07; warm-white normalization of repeated white/Slate 100 text                     |
| `designTokens.color.dark.textSecondary`  | `#D6C5C5` | S01/S07; warm normalization of repeated Slate 300/400 secondary text                   |
| `designTokens.color.dark.divider`        | `#5A3939` | S01/S05/S07; normalized dark borders and white-at-low-opacity rules                    |
| `designTokens.color.status.success`      | `#059669` | S02/S10; normalized Emerald 600 positive/order/payment state                           |
| `designTokens.color.status.warning`      | `#D97706` | S02/S10; normalized Amber 600 pending/shipping state                                   |
| `designTokens.color.status.error`        | `#DC2626` | S02/S10; normalized Red 600 failure/negative state                                     |
| `designTokens.color.status.info`         | `#2563EB` | S02/S10; normalized Blue 600 processing/information state, not a brand-primary revival |

## Typography source map

Plus Jakarta Sans appears in 31 of 45 configs and includes weights 300–800 in the principal customer
export. The product scale regularizes the repeated Tailwind sizes; values are CSS pixels and paired
line heights, not rem values, so MUI can convert them consistently in the next task.

| Token                                                                                                            | Value                          | Source                              |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------ | ----------------------------------- |
| `designTokens.typography.fontFamily.sans`                                                                        | Plus Jakarta Sans/system stack | S01/S02/S09                         |
| `designTokens.typography.fontWeight.regular`                                                                     | `400`                          | S01/S02/S09                         |
| `designTokens.typography.fontWeight.medium`                                                                      | `500`                          | S01/S02/S09                         |
| `designTokens.typography.fontWeight.semiBold`                                                                    | `600`                          | S01/S02/S09                         |
| `designTokens.typography.fontWeight.bold`                                                                        | `700`                          | S01/S02/S09                         |
| `designTokens.typography.fontWeight.extraBold`                                                                   | `800`                          | S01/S02/S09                         |
| `designTokens.typography.scale.caption.fontSize`, `designTokens.typography.scale.caption.lineHeight`             | `12 / 16` px                   | S01/S02/S04; `text-xs`              |
| `designTokens.typography.scale.bodySmall.fontSize`, `designTokens.typography.scale.bodySmall.lineHeight`         | `14 / 20` px                   | S01–S06; `text-sm`                  |
| `designTokens.typography.scale.body.fontSize`, `designTokens.typography.scale.body.lineHeight`                   | `16 / 24` px                   | S01–S06; base copy                  |
| `designTokens.typography.scale.title.fontSize`, `designTokens.typography.scale.title.lineHeight`                 | `18 / 24` px                   | S01/S02/S04; `text-lg`              |
| `designTokens.typography.scale.headingSmall.fontSize`, `designTokens.typography.scale.headingSmall.lineHeight`   | `20 / 28` px                   | S01/S02/S06; `text-xl`              |
| `designTokens.typography.scale.headingMedium.fontSize`, `designTokens.typography.scale.headingMedium.lineHeight` | `24 / 32` px                   | S02/S04/S06; `text-2xl`             |
| `designTokens.typography.scale.headingLarge.fontSize`, `designTokens.typography.scale.headingLarge.lineHeight`   | `30 / 38` px                   | S01/S02/S06; `text-3xl`             |
| `designTokens.typography.scale.display.fontSize`, `designTokens.typography.scale.display.lineHeight`             | `36 / 44` px                   | S01/S06; `text-4xl`                 |
| `designTokens.typography.scale.hero.fontSize`, `designTokens.typography.scale.hero.lineHeight`                   | `48 / 56` px                   | S01/S06; rare `text-5xl` hero usage |
| `designTokens.typography.letterSpacing.tight`                                                                    | `-0.02em`                      | S01/S02/S04; `tracking-tight`       |
| `designTokens.typography.letterSpacing.normal`                                                                   | `0`                            | S01–S09; default body rhythm        |
| `designTokens.typography.letterSpacing.wide`                                                                     | `0.08em`                       | S02/S04/S05; labels and overlines   |

English and Portuguese use this family directly. Farsi inherits the same tokenized stack until the
dedicated localization/font task validates and adds a Persian-capable face; no unsupported font was
invented from these English-only exports.

## Spacing source map

S09 found a dominant four-pixel rhythm: `4`, `8`, `12`, `16`, and `24` px are the most repeated
values, with two-pixel half steps for compact controls. Larger values describe section rhythm rather
than arbitrary component margins.

| Token                           | Value | Source                                      |
| ------------------------------- | ----: | ------------------------------------------- |
| `designTokens.spacing.none`     |  0 px | S09; reset/edge alignment                   |
| `designTokens.spacing.hairline` |  2 px | S09; half-step                              |
| `designTokens.spacing.xs`       |  4 px | S09; `1` scale, 526 occurrences             |
| `designTokens.spacing.compact`  |  6 px | S09; `1.5` scale, compact controls          |
| `designTokens.spacing.sm`       |  8 px | S09; `2` scale, 694 occurrences             |
| `designTokens.spacing.control`  | 10 px | S09; `2.5` scale                            |
| `designTokens.spacing.md`       | 12 px | S09; `3` scale, 648 occurrences             |
| `designTokens.spacing.lg`       | 16 px | S09; `4` scale, 980 occurrences             |
| `designTokens.spacing.xl`       | 20 px | S09; `5` scale                              |
| `designTokens.spacing.2xl`      | 24 px | S09; `6` scale, 508 occurrences             |
| `designTokens.spacing.3xl`      | 32 px | S09; `8` scale                              |
| `designTokens.spacing.4xl`      | 40 px | S09; `10` scale                             |
| `designTokens.spacing.5xl`      | 48 px | S09; `12` scale                             |
| `designTokens.spacing.6xl`      | 64 px | S01/S02/S09; `16` section scale             |
| `designTokens.spacing.7xl`      | 80 px | S01/S04/S09; `20` mobile-navigation reserve |
| `designTokens.spacing.8xl`      | 96 px | S01/S06/S09; `24` major section scale       |

## Breakpoint source map

The exports use Tailwind's `sm`, `md`, `lg`, and `xl` prefixes 10, 55, 16, and 7 times respectively.
The typed values preserve those exact thresholds so layouts do not drift when translated to MUI.

| Token                        |    Value | Source                                   |
| ---------------------------- | -------: | ---------------------------------------- |
| `designTokens.breakpoint.xs` |     0 px | S01/S03/S04; mobile-first base           |
| `designTokens.breakpoint.sm` |   640 px | S03/S05/S09; first compact-grid boundary |
| `designTokens.breakpoint.md` |   768 px | S03/S04/S09; dominant responsive prefix  |
| `designTokens.breakpoint.lg` | 1,024 px | S02/S03/S09; desktop/admin navigation    |
| `designTokens.breakpoint.xl` | 1,280 px | S02/S03/S09; four-column/wide layouts    |

`1536 × 864` remains a required wide-desktop QA viewport, but no supplied export introduces a
`2xl` design breakpoint, so it is not promoted to a token.

## Radius source map

The most common exported classes are `rounded-lg` (400), `rounded-full` (346), `rounded-xl` (283),
`rounded-2xl` (65), and `rounded-3xl` (23). The normalized names below retain their pixel values.

| Token                      |    Value | Source                         |
| -------------------------- | -------: | ------------------------------ |
| `designTokens.radius.none` |     0 px | S09; square/reset state        |
| `designTokens.radius.xs`   |     4 px | S01–S09; configured default    |
| `designTokens.radius.sm`   |     8 px | S01–S09; configured `lg`       |
| `designTokens.radius.md`   |    12 px | S01–S09; configured `xl`       |
| `designTokens.radius.lg`   |    16 px | S01/S04/S05/S09; `rounded-2xl` |
| `designTokens.radius.xl`   |    24 px | S01/S04/S05/S09; `rounded-3xl` |
| `designTokens.radius.pill` | 9,999 px | S01–S10; configured full/pill  |

## Shadow source map

S09 contains 140 small, 28 medium, 74 large, 24 extra-large, and 26 double-extra-large shadow
utilities, plus brand-tinted focus/glow treatments. The normalized scale uses navy/warm-dark shadow
hues instead of anonymous black.

| Token                          | Value/role                      | Source                                |
| ------------------------------ | ------------------------------- | ------------------------------------- |
| `designTokens.shadow.none`     | No elevation                    | S03/S09; flat/selected states         |
| `designTokens.shadow.subtle`   | One-pixel ambient shadow        | S01/S02/S09; chips and quiet controls |
| `designTokens.shadow.card`     | Low card elevation              | S01/S02/S04/S09                       |
| `designTokens.shadow.raised`   | Hover/raised card elevation     | S01/S03/S04/S09                       |
| `designTokens.shadow.floating` | Navigation and floating actions | S01/S04/S05/S09                       |
| `designTokens.shadow.dialog`   | Dialog/drawer elevation         | S05/S07/S09                           |
| `designTokens.shadow.focus`    | Three-pixel coral focus ring    | S01/S04/S05; normalized brand glows   |

## Motion source map

Transitions are short and functional. Across S09, duration classes occur 4 times at 200 ms, 28 at
300 ms, and 20 at 500 ms; `transition-colors`, `transition-all`, and `transition-transform` dominate.
The exported `ease-in-out` behavior is normalized into standard/enter/exit curves for component use.

| Token                                         | Value/role            | Source                                      |
| --------------------------------------------- | --------------------- | ------------------------------------------- |
| `designTokens.motion.duration.instant`        | `0 ms`                | S09; state changes without animation        |
| `designTokens.motion.duration.fast`           | `200 ms`              | S03/S05/S09; compact feedback               |
| `designTokens.motion.duration.standard`       | `300 ms`              | S01–S09; dominant interaction duration      |
| `designTokens.motion.duration.slow`           | `500 ms`              | S01/S03/S05/S09; overlays/carousels         |
| `designTokens.motion.easing.standard`         | Standard ease-in-out  | S03/S05/S09; exported `ease-in-out`         |
| `designTokens.motion.easing.enter`            | Decelerating entrance | S05; normalized modal/snackbar entrance     |
| `designTokens.motion.easing.exit`             | Accelerating exit     | S05; normalized modal/snackbar exit         |
| `designTokens.motion.transform.hoverScale`    | `1.05`                | S01/S03/S04/S09; repeated `scale-105`       |
| `designTokens.motion.transform.pressedScale`  | `0.95`                | S01/S04/S05/S09; repeated active `scale-95` |
| `designTokens.motion.transform.slideDistance` | `4 px`                | S01/S03/S09; repeated one-step translations |

Components must disable non-essential transforms and collapse durations when the user requests
reduced motion. That behavior belongs in the MUI theme/component integration rather than as a second
parallel duration scale.

## Consumption rules

- Import values from `@/theme`; never copy a literal from a Stitch HTML file into a component.
- Use semantic color roles. Blue is an information/status color only, not an admin brand theme.
- Use `brand.primaryText` for normal coral text on light surfaces and `brand.onPrimary` for normal
  text on the exact coral background.
- Treat values absent from this record as component composition details. Promote a repeated new value
  only after updating the typed token, this source map, and its tests together.
- The next MUI task adapts these framework-neutral tokens into light/dark themes and component
  overrides; it must not silently rename or change the source values.
