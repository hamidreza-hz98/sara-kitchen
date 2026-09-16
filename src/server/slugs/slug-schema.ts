import type { SchemaDefinitionProperty } from "mongoose";

import { SLUG_MAX_LENGTH, SLUG_PATTERN, normalizeSlug } from "./slug-policy";

export type SlugFieldOptions = {
  maxLength?: number;
};

/**
 * Standard root-level slug field. `unique` creates the final concurrency guard; services still use
 * `resolveUniqueSlug()` for friendly deterministic candidates and retry duplicate-key races.
 */
export function createSlugField(options: SlugFieldOptions = {}): SchemaDefinitionProperty<string> {
  const maxLength = options.maxLength ?? SLUG_MAX_LENGTH;
  normalizeSlug("slug", { maxLength });

  return {
    type: String,
    index: true,
    maxlength: maxLength,
    required: true,
    trim: true,
    unique: true,
    validate: {
      validator: (value: string) => SLUG_PATTERN.test(value),
      message: "Slug must be a normalized lowercase ASCII URL segment.",
    },
  };
}
