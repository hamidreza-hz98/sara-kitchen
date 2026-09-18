import "server-only";

import { SUPPORTED_LOCALES } from "@/constants";

import {
  MediaUpdateRepositoryConflictError,
  type MediaMetadataUpdate,
  type MediaUpdateRepository,
} from "../repository/media-update";

export type MediaUpdateErrorCode =
  "conflict" | "extension_mismatch" | "invalid_name" | "invalid_translations" | "not_found";

export class MediaUpdateError extends Error {
  constructor(readonly code: MediaUpdateErrorCode) {
    super(code);
    this.name = "MediaUpdateError";
  }
}

export type UpdateMediaMetadataInput = Readonly<{
  id: string;
  actorId: string;
  update: MediaMetadataUpdate;
}>;

const encoder = new TextEncoder();

function extension(value: string): string {
  return value.slice(value.lastIndexOf(".") + 1).toLowerCase();
}

function validateName(value: string): void {
  if (
    value !== value.normalize("NFC") ||
    encoder.encode(value).length > 180 ||
    !/^[\p{L}\p{N}][\p{L}\p{N} _-]*\.[a-zA-Z0-9]+$/u.test(value)
  ) {
    throw new MediaUpdateError("invalid_name");
  }
}

function validateTranslations(translations: readonly { locale: string; alt: string }[]): void {
  const locales = new Set<string>();
  for (const translation of translations) {
    if (
      !SUPPORTED_LOCALES.includes(translation.locale as (typeof SUPPORTED_LOCALES)[number]) ||
      locales.has(translation.locale) ||
      translation.alt.trim().length < 1 ||
      translation.alt.length > 500
    ) {
      throw new MediaUpdateError("invalid_translations");
    }
    locales.add(translation.locale);
  }
  if (!locales.has("en")) throw new MediaUpdateError("invalid_translations");
}

export async function updateMediaMetadata(
  repository: MediaUpdateRepository,
  input: UpdateMediaMetadataInput,
) {
  if (input.update.originalName === undefined && input.update.translations === undefined) {
    throw new MediaUpdateError("invalid_name");
  }
  if (input.update.originalName !== undefined) validateName(input.update.originalName);
  if (input.update.translations !== undefined) validateTranslations(input.update.translations);
  const current = await repository.findMetadata(input.id);
  if (!current) throw new MediaUpdateError("not_found");
  if (
    input.update.originalName !== undefined &&
    extension(input.update.originalName) !== extension(current.originalName)
  ) {
    throw new MediaUpdateError("extension_mismatch");
  }
  try {
    const updated = await repository.saveMetadata(current, input.update, input.actorId);
    if (!updated) throw new MediaUpdateError("not_found");
    return {
      id: updated.id,
      originalName: updated.originalName,
      translations: updated.translations,
    };
  } catch (error) {
    if (error instanceof MediaUpdateRepositoryConflictError) {
      throw new MediaUpdateError("conflict");
    }
    throw error;
  }
}
