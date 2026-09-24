import { describe, expect, it } from "vitest";

import { sharedDishCreateSchema, sharedDishUpdateSchema } from "@/validations/dish-mutation";

const base = {
  translations: [{ locale: "en", name: "Fesenjan", specifications: [] }],
  basePriceCents: 1_200,
};

describe("shared dish mutation validation", () => {
  it("normalizes date strings exactly once for client and Route Handler use", () => {
    const result = sharedDishCreateSchema.parse({
      ...base,
      discount: {
        type: "percentage",
        amountCents: null,
        basisPoints: 1_000,
        startsAt: "2026-09-24T10:00:00.000Z",
        endsAt: null,
      },
    });
    expect(result.discount?.startsAt).toBeInstanceOf(Date);
    expect(result.discount?.basisPoints).toBe(1_000);
  });

  it("rejects duplicate references, incomplete ingredient quantities, and empty updates", () => {
    const id = "a".repeat(24);
    expect(sharedDishCreateSchema.safeParse({ ...base, mediaIds: [id, id] }).success).toBe(false);
    expect(
      sharedDishCreateSchema.safeParse({
        ...base,
        ingredients: [{ ingredientId: id, notes: [], quantityAmount: 10, quantityUnit: null }],
      }).success,
    ).toBe(false);
    expect(sharedDishUpdateSchema.safeParse({}).success).toBe(false);
  });
});
