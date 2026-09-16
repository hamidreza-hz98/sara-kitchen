import type { z } from "zod";

export const VALIDATION_MESSAGE_KEYS = [
  "required",
  "invalidRequest",
  "invalidJson",
  "invalidFormData",
  "unsupportedContentType",
  "invalidType",
  "invalidFormat",
  "invalidEmail",
  "invalidChoice",
  "unknownFields",
  "minLength",
  "maxLength",
  "minValue",
  "maxValue",
  "invalidFileName",
  "fileTooLarge",
  "unsupportedFileType",
] as const;

export type ValidationMessageKey = (typeof VALIDATION_MESSAGE_KEYS)[number];
export type ValidationMessageValues = Readonly<Record<string, number>>;
export type ValidationMessageTranslator = (
  key: ValidationMessageKey,
  values?: ValidationMessageValues,
) => string;

export type LocalizedValidationIssue = {
  code: string;
  message: string;
  path: readonly (number | string)[];
};

export type LocalizedIssueOptions = {
  key: ValidationMessageKey;
  path?: readonly (number | string)[];
  values?: ValidationMessageValues;
};

export type LocalizeZodIssueOptions = {
  input?: unknown;
  maxIssues?: number;
};

const SAFE_PATH_SEGMENT = /^[A-Za-z0-9_-]{1,64}$/u;
const MESSAGE_KEY_SET = new Set<string>(VALIDATION_MESSAGE_KEYS);

function isValidationMessageKey(value: unknown): value is ValidationMessageKey {
  return typeof value === "string" && MESSAGE_KEY_SET.has(value);
}

function sanitizePath(path: readonly PropertyKey[]): readonly (number | string)[] {
  return path.slice(0, 16).map((segment) => {
    if (typeof segment === "number") {
      return Number.isSafeInteger(segment) && segment >= 0 ? segment : "_";
    }
    return typeof segment === "string" && SAFE_PATH_SEGMENT.test(segment) ? segment : "_";
  });
}

function safeNumericValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function hasDefinedValueAtPath(input: unknown, path: readonly PropertyKey[]): boolean {
  let current = input;
  for (const segment of path) {
    if (current === null || typeof current !== "object") return false;
    if (!Object.prototype.hasOwnProperty.call(current, segment)) return false;
    current = (current as Record<PropertyKey, unknown>)[segment];
  }
  return current !== undefined;
}

function mappedIssue(
  issue: z.core.$ZodIssue,
  input: unknown,
): {
  code: string;
  key: ValidationMessageKey;
  values?: ValidationMessageValues;
} {
  if (issue.code === "custom") {
    const params = issue.params as Record<string, unknown> | undefined;
    const key = params?.validationKey;
    if (isValidationMessageKey(key)) {
      const rawValues = params?.validationValues;
      const values =
        rawValues && typeof rawValues === "object"
          ? Object.fromEntries(
              Object.entries(rawValues).filter(
                (entry): entry is [string, number] =>
                  typeof entry[1] === "number" && Number.isFinite(entry[1]),
              ),
            )
          : undefined;
      return {
        code: key.replace(/[A-Z]/gu, (character) => `_${character.toLowerCase()}`),
        key,
        ...(values && Object.keys(values).length > 0 ? { values } : {}),
      };
    }
  }

  if (issue.code === "invalid_type") {
    return !hasDefinedValueAtPath(input, issue.path)
      ? { code: "required", key: "required" }
      : { code: "invalid_type", key: "invalidType" };
  }
  if (issue.code === "invalid_format") {
    return issue.format === "email"
      ? { code: "invalid_email", key: "invalidEmail" }
      : { code: "invalid_format", key: "invalidFormat" };
  }
  if (issue.code === "too_small") {
    const minimum = safeNumericValue(issue.minimum);
    const isText = issue.origin === "string";
    return {
      code: isText ? "min_length" : "min_value",
      key: isText ? "minLength" : "minValue",
      ...(minimum === undefined ? {} : { values: { min: minimum } }),
    };
  }
  if (issue.code === "too_big") {
    const maximum = safeNumericValue(issue.maximum);
    const isText = issue.origin === "string";
    return {
      code: isText ? "max_length" : "max_value",
      key: isText ? "maxLength" : "maxValue",
      ...(maximum === undefined ? {} : { values: { max: maximum } }),
    };
  }
  if (issue.code === "unrecognized_keys") {
    return { code: "unknown_fields", key: "unknownFields" };
  }
  if (issue.code === "invalid_value") {
    return { code: "invalid_choice", key: "invalidChoice" };
  }

  return { code: "invalid_value", key: "invalidFormat" };
}

/** Add a custom issue whose public presentation is selected later by locale. */
export function addLocalizedIssue(context: z.RefinementCtx, options: LocalizedIssueOptions): void {
  context.addIssue({
    code: "custom",
    message: options.key,
    ...(options.path ? { path: [...options.path] } : {}),
    params: {
      validationKey: options.key,
      ...(options.values ? { validationValues: options.values } : {}),
    },
  });
}

/** Convert Zod issues without forwarding raw messages, inputs, or unknown object keys. */
export function localizeZodIssues(
  issues: readonly z.core.$ZodIssue[],
  translate: ValidationMessageTranslator,
  options: LocalizeZodIssueOptions = {},
): readonly LocalizedValidationIssue[] {
  const maxIssues = options.maxIssues ?? 50;
  const boundedMaximum =
    Number.isSafeInteger(maxIssues) && maxIssues >= 1 && maxIssues <= 100 ? maxIssues : 50;

  return issues.slice(0, boundedMaximum).map((issue) => {
    const mapped = mappedIssue(issue, options.input);
    return {
      code: mapped.code,
      message: translate(mapped.key, mapped.values),
      path: sanitizePath(issue.path),
    };
  });
}
