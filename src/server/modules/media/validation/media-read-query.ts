import "server-only";

import { z } from "zod";

import { normalizeSearchText } from "@/server/database/schema";
import { parseQueryParameters } from "@/server/http";
import type { QueryParameterSource, RequestValidationOptions } from "@/server/http";
import { addLocalizedIssue } from "@/validations/request";

import { MEDIA_KINDS, MEDIA_MIME_PATTERN, MEDIA_PROCESSING_STATES } from "./media-metadata";

const objectId = z.string().regex(/^[a-f\d]{24}$/iu);
const date = z.coerce.date();
const sortFields = ["createdAt", "originalName", "bytes", "usageCount"] as const;

const mediaListSchema = z
  .strictObject({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(80).optional(),
    kind: z.enum(MEDIA_KINDS).optional(),
    mimeType: z.string().trim().toLowerCase().regex(MEDIA_MIME_PATTERN).optional(),
    uploaderId: objectId.optional(),
    createdFrom: date.optional(),
    createdTo: date.optional(),
    usage: z.enum(["used", "unused"]).optional(),
    processingState: z.enum(MEDIA_PROCESSING_STATES).optional(),
    sortBy: z.enum(sortFields).default("createdAt"),
    sortDirection: z.enum(["asc", "desc"]).default("desc"),
  })
  .superRefine((value, context) => {
    if (value.page * value.pageSize > 10_000) {
      addLocalizedIssue(context, { key: "maxValue", path: ["page"], values: { max: 10_000 } });
    }
    if (value.search !== undefined && normalizeSearchText(value.search).length < 2) {
      addLocalizedIssue(context, { key: "minLength", path: ["search"], values: { min: 2 } });
    }
    if (value.createdFrom && value.createdTo && value.createdFrom > value.createdTo) {
      addLocalizedIssue(context, { key: "invalidChoice", path: ["createdTo"] });
    }
  });

export type MediaListQueryPlan = Readonly<{
  filter: Readonly<Record<string, unknown>>;
  page: number;
  pageSize: number;
  skip: number;
  limit: number;
  sort: Readonly<Record<string, 1 | -1>>;
  sortBy: (typeof sortFields)[number];
  sortDirection: "asc" | "desc";
}>;

export function parseMediaListQuery(
  source: QueryParameterSource,
  options: RequestValidationOptions,
): MediaListQueryPlan {
  const value = parseQueryParameters(source, mediaListSchema, options);
  const filter: Record<string, unknown> = { deletedAt: null };
  if (value.kind) filter.kind = value.kind;
  if (value.mimeType) filter.mimeType = value.mimeType;
  if (value.uploaderId) filter.uploaderId = value.uploaderId;
  if (value.processingState) filter.processingState = value.processingState;
  if (value.usage === "used") filter.usageCount = { $gt: 0 };
  if (value.usage === "unused") filter.usageCount = 0;
  if (value.createdFrom || value.createdTo) {
    filter.createdAt = {
      ...(value.createdFrom ? { $gte: value.createdFrom } : {}),
      ...(value.createdTo ? { $lte: value.createdTo } : {}),
    };
  }
  if (value.search) {
    filter.$text = { $search: normalizeSearchText(value.search) };
  }
  const direction = value.sortDirection === "asc" ? 1 : -1;
  return {
    filter,
    page: value.page,
    pageSize: value.pageSize,
    skip: (value.page - 1) * value.pageSize,
    limit: value.pageSize,
    sort: { [value.sortBy]: direction, _id: direction },
    sortBy: value.sortBy,
    sortDirection: value.sortDirection,
  };
}
