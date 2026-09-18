import "server-only";

import type { MediaDeleteRepository } from "../repository/media-delete";

export const MEDIA_RECYCLE_WINDOW_DAYS = 30;
const RECYCLE_WINDOW_MS = MEDIA_RECYCLE_WINDOW_DAYS * 24 * 60 * 60 * 1_000;

export type MediaDeleteErrorCode = "not_found" | "referenced";

export class MediaDeleteError extends Error {
  constructor(
    readonly code: MediaDeleteErrorCode,
    readonly referenceCount?: number,
  ) {
    super(code);
    this.name = "MediaDeleteError";
  }
}

export type DeleteMediaInput = Readonly<{
  actorId: string;
  id: string;
  now?: Date;
}>;

export async function deleteMediaSafely(
  repository: MediaDeleteRepository,
  input: DeleteMediaInput,
) {
  const deletedAt = new Date(input.now?.getTime() ?? Date.now());
  if (Number.isNaN(deletedAt.getTime())) throw new TypeError("Deletion time must be valid.");

  const result = await repository.softDeleteUnreferenced(input.id, input.actorId, deletedAt);
  if (result.status === "not_found") throw new MediaDeleteError("not_found");
  if (result.status === "referenced") {
    throw new MediaDeleteError("referenced", result.referenceCount);
  }

  return {
    id: input.id,
    deletedAt: result.deletedAt.toISOString(),
    purgeEligibleAt: new Date(result.deletedAt.getTime() + RECYCLE_WINDOW_MS).toISOString(),
    recycleWindowDays: MEDIA_RECYCLE_WINDOW_DAYS,
  } as const;
}
