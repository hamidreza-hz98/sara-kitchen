import { z } from "zod";

import { addLocalizedIssue } from "./issues";

export const SORT_DIRECTIONS = ["asc", "desc"] as const;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const paginationSchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export type PaginationInput = z.input<typeof paginationSchema>;
export type Pagination = z.output<typeof paginationSchema>;

export function createSortSchema<const Fields extends readonly [string, ...string[]]>(
  allowedFields: Fields,
) {
  if (new Set(allowedFields).size !== allowedFields.length) {
    throw new TypeError("Sort fields must be unique.");
  }

  return z.strictObject({
    sortBy: z.enum(allowedFields),
    sortDirection: z.enum(SORT_DIRECTIONS).default("asc"),
  });
}

export function createFilterSchema<Shape extends z.ZodRawShape>(shape: Shape) {
  return z.strictObject(shape);
}

export type FileMetadata = {
  name: string;
  size: number;
  type: string;
};

export type FileMetadataSchemaOptions<MimeType extends string = string> = {
  allowedMimeTypes: readonly [MimeType, ...MimeType[]];
  maxBytes: number;
  maxNameLength?: number;
};

const SAFE_FILE_NAME = /^[^/\\<>:"|?*\u0000-\u001F\u007F]+$/u;

export function createFileMetadataSchema<const MimeType extends string>(
  options: FileMetadataSchemaOptions<MimeType>,
) {
  const maxNameLength = options.maxNameLength ?? 255;
  if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes < 1) {
    throw new TypeError("File maxBytes must be a positive safe integer.");
  }
  if (!Number.isSafeInteger(maxNameLength) || maxNameLength < 1 || maxNameLength > 255) {
    throw new TypeError("File maxNameLength must be an integer from 1 to 255.");
  }

  const allowedMimeTypes = new Set(options.allowedMimeTypes.map((type) => type.toLowerCase()));
  if (allowedMimeTypes.size !== options.allowedMimeTypes.length) {
    throw new TypeError("Allowed MIME types must be unique.");
  }

  return z
    .strictObject({
      name: z.string().trim(),
      size: z.number(),
      type: z.string().trim().toLowerCase(),
    })
    .superRefine((file, context) => {
      if (
        file.name.length === 0 ||
        file.name === "." ||
        file.name === ".." ||
        file.name.length > maxNameLength ||
        !SAFE_FILE_NAME.test(file.name)
      ) {
        addLocalizedIssue(context, { key: "invalidFileName", path: ["name"] });
      }
      if (!Number.isSafeInteger(file.size) || file.size < 1) {
        addLocalizedIssue(context, { key: "minValue", path: ["size"], values: { min: 1 } });
      } else if (file.size > options.maxBytes) {
        addLocalizedIssue(context, {
          key: "fileTooLarge",
          path: ["size"],
          values: { max: options.maxBytes },
        });
      }
      if (!allowedMimeTypes.has(file.type)) {
        addLocalizedIssue(context, { key: "unsupportedFileType", path: ["type"] });
      }
    });
}
