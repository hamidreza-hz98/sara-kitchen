# Translation value conventions (SK-0037)

Authored multilingual aggregates store one typed, embedded `translations` array. English (`en`) is
the canonical authoring locale; Portuguese (`pt-PT`) and Farsi (`fa`) entries may be absent while a
draft is incomplete. Every stored translation entry has a supported `locale` and only fields whose
meaning changes with language.

```ts
type DishTranslation = TranslationValue & {
  name?: string;
  excerpt?: string;
  description?: RichTextDocument;
};

type DishDocument = BaseDocumentFields &
  WithTranslations<DishTranslation> & {
    priceMinor: number;
    mediaIds: Types.ObjectId[];
    status: DishStatus;
  };

const dishSchema = createBaseSchema<DishDocument>({
  priceMinor: { type: Number, min: 0, required: true },
  mediaIds: [{ type: Schema.Types.ObjectId, ref: "Media" }],
  status: { type: String, required: true },
  translations: createTranslationsField<DishTranslation>(
    {
      name: { type: String, trim: true },
      excerpt: { type: String, trim: true },
      description: { type: Schema.Types.Mixed },
    },
    { canonicalTextFields: ["name"] },
  ),
});
```

## Placement rule

Place names, titles, excerpts, descriptions, labels, and other linguistic content inside each
entity-specific translation entry. Keep all locale-independent values at the aggregate root,
including IDs, slugs, media references, integer money, discounts, availability, statuses, lead
times, locations, relationships, counters, permissions, actor metadata, and timestamps. A field
must not be copied into translations merely because a localized form displays it.

Translation subdocuments deliberately have no `_id`. Their identity is the locale, which is immutable
after creation. Replace an entry when its locale needs to change.

## Validation contract

`createTranslationsField()` enforces this draft-level invariant:

- the array is present and non-empty;
- every locale is one of `en`, `pt-PT`, or `fa`;
- each locale appears at most once;
- an English entry exists;
- every configured `canonicalTextFields` value contains non-whitespace English text.

Each module chooses its canonical identity text, normally `name` or `title`. It may add stricter
entity validation. Publication validation is a separate policy and must require every language
enabled in Settings plus entity-specific required fields.

`validateTranslationValues()` exposes the same invariant as stable issue codes for Zod/service
validation and form error mapping. Repositories must validate the complete proposed array before an
atomic update. Do not use `$push`/`$addToSet` to bypass whole-array uniqueness checks; load and save the
aggregate or `$set` a fully validated replacement array. MongoDB cannot enforce uniqueness among
locale values inside one document with a multikey unique index.

## Failure codes

| Code                       | Meaning                                             |
| -------------------------- | --------------------------------------------------- |
| `translations_required`    | No translation entry was supplied.                  |
| `unsupported_locale`       | An entry does not use a configured launch locale.   |
| `duplicate_locale`         | A locale appears more than once in the same array.  |
| `canonical_locale_missing` | The English entry is absent.                        |
| `canonical_text_missing`   | Configured canonical English text is blank/missing. |

The shared helper validates draft shape, not locale selection. Response mapping and fallback are
handled by the localized-value selection contract in SK-0038.
