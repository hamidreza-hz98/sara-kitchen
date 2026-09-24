import { describe, expect, it } from "vitest";

import { sharedBlogCreateSchema, sharedBlogUpdateSchema } from "@/validations/blog-mutation";

const content = { schemaVersion: 1, document: { type: "doc", content: [] } } as const;
const base = {
  translations: [
    {
      locale: "en",
      title: "Persian hospitality",
      excerpt: "A welcoming table.",
      content,
    },
  ],
  readTimeMinutes: 4,
};

describe("shared blog mutation validation", () => {
  it("accepts the editor payload used by Route Handlers", () => {
    const id = "a".repeat(24);
    expect(
      sharedBlogCreateSchema.parse({
        ...base,
        imageMediaId: id,
        tags: ["persian-food"],
        relatedDishIds: [id],
      }),
    ).toMatchObject(base);
  });

  it("rejects duplicate locales/references, invalid rich-text envelopes, and empty updates", () => {
    const id = "a".repeat(24);
    expect(
      sharedBlogCreateSchema.safeParse({
        ...base,
        translations: [...base.translations, ...base.translations],
      }).success,
    ).toBe(false);
    expect(sharedBlogCreateSchema.safeParse({ ...base, relatedBlogIds: [id, id] }).success).toBe(
      false,
    );
    expect(
      sharedBlogCreateSchema.safeParse({
        ...base,
        translations: [{ ...base.translations[0], content: { schemaVersion: 2 } }],
      }).success,
    ).toBe(false);
    expect(sharedBlogUpdateSchema.safeParse({}).success).toBe(false);
  });
});
