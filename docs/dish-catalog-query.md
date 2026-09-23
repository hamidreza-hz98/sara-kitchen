# Dish catalog list/query service (SK-0095)

`createDishCatalogService()` is the public menu-list boundary. It always scopes reads to non-deleted,
published dishes, evaluates time-dependent state once per request, and maps MongoDB records to an
explicit public DTO. The service accepts an injectable clock so availability and discount boundaries
remain deterministic in tests and within one response.

## Query contract

| Control            | Contract                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| `locale`           | `en`, `pt-PT`, or `fa`; defaults to English and resolves requested → configured fallback → English.       |
| `search`           | 2–80 trimmed characters; normalized and executed through the Dish text index.                             |
| `categoryId`       | One valid Category ObjectId.                                                                              |
| `availability`     | `all`, `available`, or `unavailable`; scheduled start is inclusive and end is exclusive.                  |
| `featured`         | Optional exact boolean filter.                                                                            |
| `discounted`       | Optional active-discount boolean evaluated at the request instant.                                        |
| `dietaryTags`      | Unique allow-listed claims with AND semantics (`$all`).                                                   |
| `excludeAllergens` | Unique EU allergen codes; excludes explicit `mayContain` and linked-ingredient `contains` matches.        |
| `sort`             | `recommended`, `newest`, `price_asc`, `price_desc`, `popular`, or `best_selling`.                         |
| `viewMode`         | `grid` or `list`; returned as presentation metadata and never trusted as a projection or database field.  |
| pagination         | Page defaults to 1, size defaults to 12, size is capped at 60, and the result window is capped at 10,000. |

All sorts include `_id` as a deterministic tie-breaker. Price sorting uses persisted base unit price,
because scheduled percentage/fixed discounts are computed at read time and are not a stable indexed
sort key. Every item still returns the authoritative effective price from `calculateDishPrice()`.
Changing price sorting to effective price requires a deliberately maintained materialized price field
or a bounded aggregation design; the application must not silently perform unbounded in-memory sort.

## Allergen behavior

The approved product rule treats selected allergens as exclusions, not positive filters. The public
Ingredient allergen catalog first resolves published ingredient IDs containing any selected allergen.
The Dish query then excludes both those ingredient references and explicit cross-contact tags. The
same Ingredient port resolves the definite `contains` union for returned items. Codes are emitted in
the stable project allow-list order and the response preserves `contains` versus `mayContain`.

## Public projection

Items contain only ID/slug, the selected localized name and excerpt with fallback/direction metadata,
media and category IDs, computed price metadata, portion, resolved orderability and next state change,
lead time, maximum order quantity, dietary/allergen information, and featured state. Raw translations,
ingredient IDs/notes, status/deletion fields, SEO internals, counters, actor metadata, schema versions,
and relationship data never cross this list boundary.

Grid/list mode does not let a client select database fields. Both receive the same bounded card-safe
DTO so switching mode requires no refetch and cannot become an arbitrary projection channel.

## Index and pagination policy

Named compound indexes cover recent public, category, featured, base-price, popular, best-selling, and
active-discount query shapes; the existing text index covers search. Dietary and explicit allergen
indexes support their filters, while Ingredient allergen lookup uses its published-allergen index.
Integration tests execute realistic filters and assert `IXSCAN` plus named index selection.

Page totals and items use the same immutable query plan but are not a transactional snapshot while
catalog writes occur. The deterministic sort prevents duplicates caused by equal sort values in a
stable dataset. If large, mutation-stable traversal becomes necessary, replace this bounded page
contract with an approved cursor/snapshot design.
