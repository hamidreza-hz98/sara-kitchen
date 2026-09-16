import { z } from "zod";
import { describe, expect, it } from "vitest";

import englishValidation from "@/locales/messages/en/validation.json";
import farsiValidation from "@/locales/messages/fa/validation.json";
import portugueseValidation from "@/locales/messages/pt-PT/validation.json";
import { apiSuccess } from "@/server/http/api-contract";
import { ApiError } from "@/server/http/api-error";
import {
  parseFileMetadata,
  parseFormDataRequest,
  parseJsonRequest,
  parseQueryParameters,
  parseRouteParameters,
  validateRequestValue,
} from "@/server/http/request-validation";
import { handleApiRoute } from "@/server/http/route-handler";
import {
  createFileMetadataSchema,
  createFilterSchema,
  createSortSchema,
  paginationSchema,
} from "@/validations/request";
import type { ValidationMessageKey, ValidationMessageTranslator } from "@/validations/request";

function createTranslator(messages: Record<string, string>): ValidationMessageTranslator {
  return (key, values) => {
    let message = messages[key] ?? key;
    for (const [name, value] of Object.entries(values ?? {})) {
      message = message.replaceAll(`{${name}}`, String(value));
    }
    return message;
  };
}

const english = createTranslator(englishValidation);
const portuguese = createTranslator(portugueseValidation);
const farsi = createTranslator(farsiValidation);

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe("request validation helpers", () => {
  it("parses and transforms valid JSON", async () => {
    const schema = z.strictObject({
      email: z.string().trim().toLowerCase().email(),
      portions: z.coerce.number().int().min(1),
    });
    const request = new Request("https://example.test/api/orders", {
      body: JSON.stringify({ email: " CHEF@EXAMPLE.COM ", portions: "2" }),
      headers: { "content-type": "application/json; charset=utf-8" },
      method: "POST",
    });

    await expect(parseJsonRequest(request, schema, { translate: english })).resolves.toEqual({
      email: "chef@example.com",
      portions: 2,
    });
  });

  it("returns localized 400 errors for malformed JSON without parser details", async () => {
    const response = await handleApiRoute(
      new Request("https://example.test/api/orders", {
        body: '{"name":',
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      async () =>
        apiSuccess(
          await parseJsonRequest(
            new Request("https://example.test", {
              body: '{"name":',
              headers: { "content-type": "application/json" },
              method: "POST",
            }),
            z.object({ name: z.string() }),
            { translate: portuguese },
          ),
        ),
    );
    const body = await json(response);

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        message: portugueseValidation.invalidRequest,
        details: {
          issues: [{ code: "invalid_json", message: portugueseValidation.invalidJson, path: [] }],
        },
      },
      ok: false,
    });
    expect(JSON.stringify(body)).not.toContain("SyntaxError");
  });

  it("parses form data and preserves repeated values", async () => {
    const form = new FormData();
    form.append("name", "Fesenjan");
    form.append("tag", "stew");
    form.append("tag", "featured");
    const schema = z.strictObject({ name: z.string(), tag: z.array(z.string()) });

    await expect(
      parseFormDataRequest(
        new Request("https://example.test/api/dishes", { body: form, method: "POST" }),
        schema,
        { translate: english },
      ),
    ).resolves.toEqual({ name: "Fesenjan", tag: ["stew", "featured"] });
  });

  it("rejects malformed form bodies with a safe localized 400", async () => {
    await expect(
      parseFormDataRequest(
        new Request("https://example.test/api/dishes", {
          body: "broken multipart payload",
          headers: { "content-type": "multipart/form-data; boundary=missing" },
          method: "POST",
        }),
        z.strictObject({ name: z.string() }),
        { translate: farsi },
      ),
    ).rejects.toMatchObject({
      details: {
        issues: [{ code: "invalid_form_data", message: farsiValidation.invalidFormData, path: [] }],
      },
      status: 400,
    });
  });

  it("parses repeated query values and promised route parameters", async () => {
    const querySchema = z.strictObject({ category: z.array(z.string()), search: z.string() });
    const routeSchema = z.strictObject({ slug: z.string().regex(/^[a-z0-9-]+$/u) });

    expect(
      parseQueryParameters(
        new URL("https://example.test/menu?category=stew&category=rice&search=saffron"),
        querySchema,
        { translate: english },
      ),
    ).toEqual({ category: ["stew", "rice"], search: "saffron" });
    await expect(
      parseRouteParameters(Promise.resolve({ slug: "koubideh-kebab" }), routeSchema, {
        translate: english,
      }),
    ).resolves.toEqual({ slug: "koubideh-kebab" });
  });

  it("validates bounded pagination and allowlisted sorting", () => {
    expect(
      parseQueryParameters(new URLSearchParams({ page: "2", pageSize: "50" }), paginationSchema, {
        translate: english,
      }),
    ).toEqual({ page: 2, pageSize: 50 });

    const sortSchema = createSortSchema(["name", "createdAt"] as const);
    expect(
      parseQueryParameters(new URLSearchParams({ sortBy: "name" }), sortSchema, {
        translate: english,
      }),
    ).toEqual({ sortBy: "name", sortDirection: "asc" });

    expect(() =>
      parseQueryParameters(new URLSearchParams({ page: "0", pageSize: "500" }), paginationSchema, {
        translate: english,
      }),
    ).toThrowError(ApiError);
  });

  it("distinguishes missing fields from wrong field types without exposing values", () => {
    const schema = z.strictObject({ name: z.string() });

    for (const [value, expectedCode, expectedMessage] of [
      [{}, "required", englishValidation.required],
      [{ name: 42 }, "invalid_type", englishValidation.invalidType],
    ] as const) {
      try {
        validateRequestValue(schema, value, { translate: english });
        throw new Error("Expected validation to fail.");
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.details?.issues).toEqual([
          { code: expectedCode, message: expectedMessage, path: ["name"] },
        ]);
        expect(JSON.stringify(apiError.details)).not.toContain("42");
      }
    }
  });

  it("localizes invalid sorting and never echoes a rejected value", async () => {
    const sortSchema = createSortSchema(["name", "createdAt"] as const);
    const rejectedValue = "DROP TABLE customers";
    const response = await handleApiRoute(new Request("https://example.test/api/dishes"), () =>
      apiSuccess(
        parseQueryParameters(new URLSearchParams({ sortBy: rejectedValue }), sortSchema, {
          translate: farsi,
        }),
      ),
    );
    const body = await json(response);

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      error: {
        message: farsiValidation.invalidRequest,
        details: {
          issues: [
            { code: "invalid_choice", message: farsiValidation.invalidChoice, path: ["sortBy"] },
          ],
        },
      },
    });
    expect(JSON.stringify(body)).not.toContain(rejectedValue);
  });

  it("rejects unknown filter fields without exposing attacker-controlled keys", () => {
    const filterSchema = createFilterSchema({ featured: z.enum(["true", "false"]) });
    const attackerField = "databasePassword";

    try {
      validateRequestValue(
        filterSchema,
        { featured: "true", [attackerField]: "secret" },
        { translate: portuguese },
      );
      throw new Error("Expected filter validation to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.status).toBe(400);
      expect(apiError.details?.issues).toEqual([
        { code: "unknown_fields", message: portugueseValidation.unknownFields, path: [] },
      ]);
      expect(JSON.stringify(apiError.details)).not.toContain(attackerField);
      expect(JSON.stringify(apiError.details)).not.toContain("secret");
    }
  });

  it("validates file metadata with localized, field-safe issues", () => {
    const fileSchema = createFileMetadataSchema({
      allowedMimeTypes: ["image/jpeg", "image/png", "application/pdf"],
      maxBytes: 1_000,
    });
    expect(
      parseFileMetadata({ name: "menu.pdf", size: 900, type: "APPLICATION/PDF" }, fileSchema, {
        translate: english,
      }),
    ).toEqual({ name: "menu.pdf", size: 900, type: "application/pdf" });

    expect(() =>
      parseFileMetadata(
        { name: "../private.exe", size: 5_000, type: "application/x-msdownload" },
        fileSchema,
        { translate: portuguese },
      ),
    ).toThrowError(ApiError);

    try {
      parseFileMetadata(
        { name: "../private.exe", size: 5_000, type: "application/x-msdownload" },
        fileSchema,
        { translate: portuguese },
      );
    } catch (error) {
      const apiError = error as ApiError;
      expect(apiError.details?.issues).toEqual(
        expect.arrayContaining([
          {
            code: "invalid_file_name",
            message: portugueseValidation.invalidFileName,
            path: ["name"],
          },
          {
            code: "file_too_large",
            message: "O ficheiro não pode exceder 1000 bytes.",
            path: ["size"],
          },
          {
            code: "unsupported_file_type",
            message: portugueseValidation.unsupportedFileType,
            path: ["type"],
          },
        ]),
      );
      const serialized = JSON.stringify(apiError.details);
      expect(serialized).not.toContain("private.exe");
      expect(serialized).not.toContain("x-msdownload");
    }

    expect(() =>
      parseFileMetadata({ name: "..", size: 1, type: "image/png" }, fileSchema, {
        translate: english,
      }),
    ).toThrowError(ApiError);
  });

  it("rejects unsupported body content types with the validation status", async () => {
    await expect(
      parseJsonRequest(
        new Request("https://example.test/api/orders", {
          body: "name=Fesenjan",
          headers: { "content-type": "text/plain" },
          method: "POST",
        }),
        z.object({ name: z.string() }),
        { translate: farsi },
      ),
    ).rejects.toMatchObject({
      details: {
        issues: [
          {
            code: "unsupported_content_type",
            message: farsiValidation.unsupportedContentType,
            path: [],
          },
        ],
      },
      status: 400,
    });
  });

  it("never forwards custom Zod messages or unsafe path segments", () => {
    const schema = z.strictObject({
      safe: z.string().refine(() => false, { message: "DATABASE_PASSWORD=do-not-expose" }),
    });
    const invalidKey =
      "unsafe.path.with.dots.and-a-very-long-name-that-exceeds-sixty-four-characters";
    const custom = z.any().superRefine((_value, context) => {
      context.addIssue({ code: "custom", message: "SECRET", path: [invalidKey] });
    });

    for (const [candidateSchema, value] of [
      [schema, { safe: "submitted-secret" }],
      [custom, "submitted-secret"],
    ] as const) {
      try {
        validateRequestValue(candidateSchema, value, { translate: english });
      } catch (error) {
        const serialized = JSON.stringify((error as ApiError).details);
        expect(serialized).not.toContain("DATABASE_PASSWORD");
        expect(serialized).not.toContain("submitted-secret");
        expect(serialized).not.toContain(invalidKey);
      }
    }
  });

  it("keeps every required localized validation key available", () => {
    const requiredKeys: ValidationMessageKey[] = [
      "invalidRequest",
      "invalidJson",
      "invalidFormData",
      "unsupportedContentType",
      "invalidType",
      "invalidFormat",
      "invalidChoice",
      "unknownFields",
      "minValue",
      "maxValue",
      "invalidFileName",
      "fileTooLarge",
      "unsupportedFileType",
    ];
    for (const key of requiredKeys) {
      expect(englishValidation[key]).toBeTruthy();
      expect(portugueseValidation[key]).toBeTruthy();
      expect(farsiValidation[key]).toBeTruthy();
    }
  });
});
