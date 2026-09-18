import { z } from "zod";

import { ApiError } from "@/server/http/api-error";
import { parseQueryParameters } from "@/server/http/request-validation";
import type {
  QueryParameterSource,
  RequestValidationOptions,
} from "@/server/http/request-validation";
import { addLocalizedIssue } from "@/validations/request";

import { normalizeSearchText } from "./schema/search-normalization";

const MAX_PAGE_SIZE = 100;
const MAX_WINDOW = 10_000;
const MAX_SEARCH_LENGTH = 80;
const SAFE_FIELD = /^[A-Za-z][A-Za-z0-9]*$/u;

type FilterSchemas = Readonly<Record<string, z.ZodType>>;

export type ListQueryConfig = {
  /** API fields, which must also be safe, top-level Mongoose paths. */
  filters?: FilterSchemas;
  sortFields: readonly [string, ...string[]];
  defaultSort: string;
  projectionFields: readonly [string, ...string[]];
  defaultProjection: readonly string[];
  search?: boolean;
};

export type ListQueryPlan = {
  filter: Readonly<Record<string, unknown>>;
  projection: Readonly<Record<string, 1>>;
  sort: Readonly<Record<string, 1 | -1>>;
  skip: number;
  limit: number;
  page: number;
  pageSize: number;
  sortBy: string;
  sortDirection: "asc" | "desc";
};

export type PageMetadata = {
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  sort: { by: string; direction: "asc" | "desc" };
};

function assertFields(fields: readonly string[], label: string): void {
  if (new Set(fields).size !== fields.length || fields.some((field) => !SAFE_FIELD.test(field))) {
    throw new TypeError(`${label} must contain unique, safe, top-level field names.`);
  }
}

/** Escaping is retained even though normalized search currently strips punctuation. */
export function escapeSearchPattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function createListQueryControls(config: ListQueryConfig) {
  const filterNames = Object.keys(config.filters ?? {});
  assertFields(config.sortFields, "Sort fields");
  assertFields(config.projectionFields, "Projection fields");
  assertFields(filterNames, "Filter fields");
  assertFields(config.defaultProjection, "Default projection");
  if (!config.sortFields.includes(config.defaultSort)) {
    throw new TypeError("Default sort must be an allowed sort field.");
  }
  if (config.defaultProjection.some((field) => !config.projectionFields.includes(field))) {
    throw new TypeError("Default projection must be within allowed projection fields.");
  }
  const reserved = ["page", "pageSize", "sortBy", "sortDirection", "search", "fields"];
  if (filterNames.some((field) => reserved.includes(field) || field === "normalizedSearchText")) {
    throw new TypeError("Filter names must not shadow query controls.");
  }

  const schema = z
    .strictObject({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
      sortBy: z.enum(config.sortFields).default(config.defaultSort),
      sortDirection: z.enum(["asc", "desc"]).default("asc"),
      fields: z.string().optional(),
      ...(config.search ? { search: z.string().trim().max(MAX_SEARCH_LENGTH).optional() } : {}),
      ...Object.fromEntries(
        Object.entries(config.filters ?? {}).map(([name, filterSchema]) => [
          name,
          filterSchema.optional(),
        ]),
      ),
    })
    .superRefine((value, context) => {
      if (value.page * value.pageSize > MAX_WINDOW) {
        addLocalizedIssue(context, {
          key: "maxValue",
          path: ["page"],
          values: { max: MAX_WINDOW },
        });
      }
      if ("search" in value && value.search !== undefined) {
        const normalized = normalizeSearchText(String(value.search));
        if (normalized.length < 2) {
          addLocalizedIssue(context, { key: "minLength", path: ["search"], values: { min: 2 } });
        }
      }
      if (value.fields !== undefined) {
        const fields = value.fields.split(",");
        if (
          fields.length > config.projectionFields.length ||
          new Set(fields).size !== fields.length ||
          fields.some((field) => !config.projectionFields.includes(field))
        ) {
          addLocalizedIssue(context, { key: "invalidChoice", path: ["fields"] });
        }
      }
    });

  function parse(source: QueryParameterSource, options: RequestValidationOptions): ListQueryPlan {
    const value = parseQueryParameters(source, schema, options);
    const filter: Record<string, unknown> = {};
    for (const name of filterNames) {
      const selected: unknown = (value as Record<string, unknown>)[name];
      if (selected !== undefined) {
        if (
          selected === null ||
          (typeof selected !== "string" &&
            typeof selected !== "number" &&
            typeof selected !== "boolean")
        ) {
          throw ApiError.validation(
            [{ code: "invalid_type", message: options.translate("invalidType"), path: [name] }],
            options.translate("invalidRequest"),
          );
        }
        filter[name] = selected;
      }
    }
    if ("search" in value && typeof value.search === "string") {
      filter.normalizedSearchText = new RegExp(
        `^${escapeSearchPattern(normalizeSearchText(value.search))}`,
        "u",
      );
    }
    const selectedFields = value.fields?.split(",") ?? config.defaultProjection;
    const projection: Record<string, 1> = { _id: 1 };
    for (const field of selectedFields) projection[field] = 1;
    const direction = value.sortDirection === "asc" ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [value.sortBy]: direction };
    if (value.sortBy !== "_id") sort._id = direction;

    return {
      filter,
      projection,
      sort,
      skip: (value.page - 1) * value.pageSize,
      limit: value.pageSize,
      page: value.page,
      pageSize: value.pageSize,
      sortBy: value.sortBy,
      sortDirection: value.sortDirection,
    };
  }

  return { parse };
}

/** Attach the same response metadata for every page-based list route. */
export function pageResult<Items>(
  items: readonly Items[],
  totalItems: number,
  plan: ListQueryPlan | Pick<ListQueryPlan, "page" | "pageSize" | "sortBy" | "sortDirection">,
) {
  if (!Number.isSafeInteger(totalItems) || totalItems < 0) {
    throw new RangeError("totalItems must be a non-negative safe integer.");
  }
  const totalPages = Math.ceil(totalItems / plan.pageSize);
  const meta: PageMetadata = {
    pagination: {
      page: plan.page,
      pageSize: plan.pageSize,
      totalItems,
      totalPages,
      hasNextPage: plan.page < totalPages,
      hasPreviousPage: plan.page > 1 && totalPages > 0,
    },
    sort: { by: plan.sortBy, direction: plan.sortDirection },
  };
  return { data: items, meta };
}
