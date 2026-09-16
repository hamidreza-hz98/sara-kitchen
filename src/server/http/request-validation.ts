import type { z } from "zod";

import { localizeZodIssues } from "@/validations/request";
import type { FileMetadata, ValidationMessageTranslator } from "@/validations/request";

import { ApiError } from "./api-error";

export type RequestValidationOptions = {
  translate: ValidationMessageTranslator;
};

export type QueryParameterSource = Request | URL | URLSearchParams;
export type RouteParameterValue = string | readonly string[] | undefined;
export type RouteParameters = Readonly<Record<string, RouteParameterValue>>;

function localizedTransportError(
  code: string,
  messageKey: "invalidFormData" | "invalidJson" | "unsupportedContentType",
  options: RequestValidationOptions,
): ApiError {
  return ApiError.validation(
    [{ code, message: options.translate(messageKey), path: [] }],
    options.translate("invalidRequest"),
  );
}

function parseWithSchema<Schema extends z.ZodType>(
  schema: Schema,
  value: unknown,
  options: RequestValidationOptions,
): z.output<Schema> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw ApiError.validation(
      localizeZodIssues(result.error.issues, options.translate, { input: value }),
      options.translate("invalidRequest"),
    );
  }
  return result.data;
}

function contentType(request: Request): string {
  return request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function isJsonContentType(value: string): boolean {
  return value === "application/json" || /^application\/[a-z0-9.-]+\+json$/u.test(value);
}

function parametersToObject(parameters: URLSearchParams | FormData): Record<string, unknown> {
  const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const [key, value] of parameters.entries()) {
    const existing = result[key];
    if (existing === undefined) {
      result[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      result[key] = [existing, value];
    }
  }
  return result;
}

function searchParameters(source: QueryParameterSource): URLSearchParams {
  if (source instanceof URLSearchParams) return source;
  if (source instanceof URL) return source.searchParams;
  return new URL(source.url).searchParams;
}

/** Validate an already extracted value with localized, field-safe failures. */
export function validateRequestValue<Schema extends z.ZodType>(
  schema: Schema,
  value: unknown,
  options: RequestValidationOptions,
): z.output<Schema> {
  return parseWithSchema(schema, value, options);
}

/** Require a JSON media type, parse the body, and validate the decoded value. */
export async function parseJsonRequest<Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
  options: RequestValidationOptions,
): Promise<z.output<Schema>> {
  if (!isJsonContentType(contentType(request))) {
    throw localizedTransportError("unsupported_content_type", "unsupportedContentType", options);
  }

  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw localizedTransportError("invalid_json", "invalidJson", options);
  }
  return parseWithSchema(schema, value, options);
}

/** Require browser form encoding, preserve repeated keys/files, and validate the decoded object. */
export async function parseFormDataRequest<Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
  options: RequestValidationOptions,
): Promise<z.output<Schema>> {
  const mediaType = contentType(request);
  if (mediaType !== "multipart/form-data" && mediaType !== "application/x-www-form-urlencoded") {
    throw localizedTransportError("unsupported_content_type", "unsupportedContentType", options);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    throw localizedTransportError("invalid_form_data", "invalidFormData", options);
  }
  return parseWithSchema(schema, parametersToObject(formData), options);
}

/** Parse query values while preserving repeated keys as arrays. */
export function parseQueryParameters<Schema extends z.ZodType>(
  source: QueryParameterSource,
  schema: Schema,
  options: RequestValidationOptions,
): z.output<Schema> {
  return parseWithSchema(schema, parametersToObject(searchParameters(source)), options);
}

/** Resolve Next.js route params (including promised params) before validation. */
export async function parseRouteParameters<Schema extends z.ZodType>(
  parameters: RouteParameters | Promise<RouteParameters>,
  schema: Schema,
  options: RequestValidationOptions,
): Promise<z.output<Schema>> {
  return parseWithSchema(schema, await parameters, options);
}

/** Validate only browser-supplied file metadata; storage still verifies streamed bytes/signatures. */
export function parseFileMetadata<Schema extends z.ZodType<FileMetadata>>(
  file: FileMetadata,
  schema: Schema,
  options: RequestValidationOptions,
): z.output<Schema> {
  return parseWithSchema(schema, file, options);
}
