# Localized formatting

`src/locales/formatters.ts` is the presentation-boundary contract for locale-sensitive values. It
uses the platform `Intl` implementation directly, has no React dependency, and is safe to call from
Server Components, Client Components, route handlers, generated documents, and tests.

## Defaults

| Helper               | Input contract                                 | Output policy                                                                                      |
| -------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `formatEuro`         | Non-negative safe integer cents                | EUR currency with the locale's symbol, grouping, decimal marks, digits, and bidirectional controls |
| `formatNumber`       | Finite number                                  | Decimal with at most two fractional digits                                                         |
| `formatUnit`         | Finite number and an `Intl` unit identifier    | Long localized unit with at most one fractional digit                                              |
| `formatRelativeTime` | Finite number and an `Intl` relative-time unit | Long text with `numeric: "auto"`, such as “yesterday”                                              |
| `formatDate`         | Valid `Date` or Unix timestamp in milliseconds | Medium localized date in the Porto time zone                                                       |
| `formatTime`         | Valid `Date` or Unix timestamp in milliseconds | Short localized time in the Porto time zone                                                        |
| `formatDateTime`     | Valid `Date` or Unix timestamp in milliseconds | Combined medium date and short time in the Porto time zone                                         |

All date/time helpers use the single `PROJECT_TIME_ZONE` value, `Europe/Lisbon`, so server location
and browser location cannot change order, delivery, activity, or invoice displays. Locale calendar
defaults remain intentional: English and Portuguese display Gregorian dates, while Persian displays
the Persian calendar and Persian digits.

EUR values follow ADR-0005: callers pass integer cents and never parsed display text. Negative,
fractional, unsafe, `NaN`, infinite, negative-zero, and invalid-date inputs fail with actionable
`RangeError` messages rather than leaking misleading values into the UI.

Money is split into whole euros and remainder cents and passed to `Intl` as an exact decimal string.
This preserves the final cent even at JavaScript's maximum safe-integer boundary; formatting the
result of direct division by 100 would lose precision for sufficiently large totals.

Formatter instances are cached by locale and, for units, locale/unit pair. This avoids repeatedly
constructing comparatively expensive `Intl` objects in tables, menus, invoices, and dashboards.

## Usage

```ts
import { formatDateTime, formatEuro, formatUnit } from "@/locales";

formatEuro(1_250, "pt-PT");
formatUnit(8.5, "kilometer", "fa");
formatDateTime(order.createdAt, "en");
```

Do not hand-build localized output, append translated unit strings, convert cents to a decimal before
calling `formatEuro`, or parse the returned strings for application calculations.

## Verification

`tests/unit/formatters.test.ts` fixes examples for English, European Portuguese, and Persian across
every helper. It also verifies invalid financial, numeric, and temporal inputs fail closed. The
tests run in `pnpm test:unit` and therefore the complete `pnpm verify` gate.
