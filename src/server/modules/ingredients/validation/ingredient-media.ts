import "server-only";

import { isValidObjectId } from "mongoose";
import type { Connection, Types } from "mongoose";

import { getMediaReferenceFacts } from "@/server/modules/media";

export class IngredientMediaReferenceError extends Error {
  constructor() {
    super("imageMediaId must refer to an existing, ready image.");
    this.name = "IngredientMediaReferenceError";
  }
}

/** Call at the ingredient service boundary; ObjectId syntax cannot verify asset state or kind. */
export async function validateIngredientImageReference(
  connection: Connection,
  imageMediaId: string | Types.ObjectId | null,
): Promise<void> {
  if (imageMediaId === null) return;
  if (!isValidObjectId(imageMediaId)) throw new IngredientMediaReferenceError();
  const [fact] = await getMediaReferenceFacts(connection, [String(imageMediaId)]);
  if (!fact || fact.kind !== "image" || fact.processingState !== "ready") {
    throw new IngredientMediaReferenceError();
  }
}
