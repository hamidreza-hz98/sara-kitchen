import "server-only";

import { isValidObjectId } from "mongoose";
import type { Connection, Types } from "mongoose";

import { getMediaReferenceFacts } from "@/server/modules/media";

export type CategoryMediaField = "bannerMediaId" | "imageMediaId";

export class CategoryMediaReferenceError extends Error {
  constructor(readonly field: CategoryMediaField) {
    super(`${field} must refer to an existing, ready image.`);
    this.name = "CategoryMediaReferenceError";
  }
}

/** Call before create/update; ObjectId syntax alone cannot prove the referenced asset's kind. */
export async function validateCategoryMediaReferences(
  connection: Connection,
  references: Readonly<Record<CategoryMediaField, string | Types.ObjectId | null>>,
): Promise<void> {
  const values = Object.entries(references) as [
    CategoryMediaField,
    string | Types.ObjectId | null,
  ][];
  for (const [field, value] of values) {
    if (value !== null && !isValidObjectId(value)) throw new CategoryMediaReferenceError(field);
  }
  const ids = values.flatMap(([, value]) => (value === null ? [] : [String(value)]));
  const facts = await getMediaReferenceFacts(connection, ids);
  const byId = new Map(facts.map((fact) => [fact.id, fact]));
  for (const [field, value] of values) {
    if (value === null) continue;
    const fact = byId.get(String(value));
    if (!fact || fact.kind !== "image" || fact.processingState !== "ready") {
      throw new CategoryMediaReferenceError(field);
    }
  }
}
