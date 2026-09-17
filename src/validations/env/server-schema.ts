import { z } from "zod";

import { EnvironmentValidationError } from "./error";

const placeholderPrefix = /^(?:change-me|replace-with)/i;

const requiredText = (label: string) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`);

const requiredSecret = (label: string, minimumLength = 32) =>
  requiredText(label)
    .min(minimumLength, `${label} must contain at least ${minimumLength} characters.`)
    .refine((value) => !placeholderPrefix.test(value), {
      message: `${label} must be replaced with a real secret.`,
    });

const emptyStringToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalText = (label: string) =>
  z.preprocess(emptyStringToUndefined, requiredText(label).optional());

const optionalUrl = (label: string) =>
  z.preprocess(
    emptyStringToUndefined,
    z
      .string({ error: `${label} is required.` })
      .trim()
      .url(`${label} must be a valid URL.`)
      .optional(),
  );

const booleanString = (label: string) =>
  z
    .enum(["true", "false"], {
      error: `${label} must be either "true" or "false".`,
    })
    .transform((value) => value === "true");

const requiredNumber = (label: string) =>
  z.coerce.number({ error: `${label} must be a number.` }).finite(`${label} must be finite.`);

const addRequiredIssue = (context: z.RefinementCtx, path: string, label: string) => {
  context.addIssue({
    code: "custom",
    path: [path],
    message: `${label} is required when the integration is enabled.`,
  });
};

export const SERVER_ENVIRONMENT_KEYS = [
  "MONGODB_URI",
  "AUTH_SESSION_SECRET",
  "AUTH_PASSWORD_RESET_SECRET",
  "LOG_LEVEL",
  "DEPLOYMENT_VERSION",
  "RESET_SMS_ENABLED",
  "TWILIO_RESET_ACCOUNT_SID",
  "TWILIO_RESET_AUTH_TOKEN",
  "TWILIO_RESET_FROM_NUMBER",
  "MINIO_ENDPOINT",
  "MINIO_PORT",
  "MINIO_USE_SSL",
  "MINIO_ACCESS_KEY",
  "MINIO_SECRET_KEY",
  "MINIO_BUCKET",
  "MINIO_REGION",
  "KITCHEN_LATITUDE",
  "KITCHEN_LONGITUDE",
  "MBWAY_ENABLED",
  "MBWAY_API_URL",
  "MBWAY_MERCHANT_ID",
  "MBWAY_API_KEY",
  "MBWAY_WEBHOOK_SECRET",
  "WHATSAPP_ENABLED",
  "WHATSAPP_API_URL",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_EMPLOYER_NUMBER",
] as const;

export const serverEnvironmentSchema = z
  .object({
    MONGODB_URI: requiredText("MONGODB_URI").regex(
      /^mongodb(?:\+srv)?:\/\//,
      "MONGODB_URI must start with mongodb:// or mongodb+srv://.",
    ),
    AUTH_SESSION_SECRET: requiredSecret("AUTH_SESSION_SECRET"),
    AUTH_PASSWORD_RESET_SECRET: requiredSecret("AUTH_PASSWORD_RESET_SECRET"),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "fatal"]).optional(),
    DEPLOYMENT_VERSION: optionalText("DEPLOYMENT_VERSION"),
    RESET_SMS_ENABLED: booleanString("RESET_SMS_ENABLED").default(false),
    TWILIO_RESET_ACCOUNT_SID: optionalText("TWILIO_RESET_ACCOUNT_SID"),
    TWILIO_RESET_AUTH_TOKEN: z.preprocess(
      emptyStringToUndefined,
      requiredSecret("TWILIO_RESET_AUTH_TOKEN").optional(),
    ),
    TWILIO_RESET_FROM_NUMBER: z.preprocess(
      emptyStringToUndefined,
      z
        .string()
        .trim()
        .regex(/^\+[1-9]\d{7,14}$/, "TWILIO_RESET_FROM_NUMBER must use E.164 format.")
        .optional(),
    ),
    MINIO_ENDPOINT: requiredText("MINIO_ENDPOINT").refine(
      (value) => !value.includes("://"),
      "MINIO_ENDPOINT must be a hostname without http:// or https://.",
    ),
    MINIO_PORT: z.coerce
      .number({ error: "MINIO_PORT must be a number." })
      .int("MINIO_PORT must be an integer.")
      .min(1, "MINIO_PORT must be between 1 and 65535.")
      .max(65_535, "MINIO_PORT must be between 1 and 65535."),
    MINIO_USE_SSL: booleanString("MINIO_USE_SSL"),
    MINIO_ACCESS_KEY: requiredText("MINIO_ACCESS_KEY").refine(
      (value) => !placeholderPrefix.test(value),
      "MINIO_ACCESS_KEY must be replaced with a real access key.",
    ),
    MINIO_SECRET_KEY: requiredSecret("MINIO_SECRET_KEY", 8),
    MINIO_BUCKET: requiredText("MINIO_BUCKET").regex(
      /^(?!\d+\.\d+\.\d+\.\d+$)[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/,
      "MINIO_BUCKET must be a valid 3-63 character S3 bucket name.",
    ),
    MINIO_REGION: requiredText("MINIO_REGION"),
    KITCHEN_LATITUDE: requiredNumber("KITCHEN_LATITUDE")
      .min(-90, "KITCHEN_LATITUDE must be between -90 and 90.")
      .max(90, "KITCHEN_LATITUDE must be between -90 and 90."),
    KITCHEN_LONGITUDE: requiredNumber("KITCHEN_LONGITUDE")
      .min(-180, "KITCHEN_LONGITUDE must be between -180 and 180.")
      .max(180, "KITCHEN_LONGITUDE must be between -180 and 180."),
    MBWAY_ENABLED: booleanString("MBWAY_ENABLED"),
    MBWAY_API_URL: optionalUrl("MBWAY_API_URL"),
    MBWAY_MERCHANT_ID: optionalText("MBWAY_MERCHANT_ID"),
    MBWAY_API_KEY: optionalText("MBWAY_API_KEY"),
    MBWAY_WEBHOOK_SECRET: z.preprocess(
      emptyStringToUndefined,
      requiredSecret("MBWAY_WEBHOOK_SECRET").optional(),
    ),
    WHATSAPP_ENABLED: booleanString("WHATSAPP_ENABLED"),
    WHATSAPP_API_URL: optionalUrl("WHATSAPP_API_URL"),
    WHATSAPP_PHONE_NUMBER_ID: optionalText("WHATSAPP_PHONE_NUMBER_ID"),
    WHATSAPP_ACCESS_TOKEN: optionalText("WHATSAPP_ACCESS_TOKEN"),
    WHATSAPP_EMPLOYER_NUMBER: z.preprocess(
      emptyStringToUndefined,
      z
        .string()
        .trim()
        .regex(/^\+[1-9]\d{7,14}$/, "WHATSAPP_EMPLOYER_NUMBER must use E.164 format.")
        .optional(),
    ),
  })
  .superRefine((environment, context) => {
    if (environment.AUTH_SESSION_SECRET === environment.AUTH_PASSWORD_RESET_SECRET) {
      context.addIssue({
        code: "custom",
        path: ["AUTH_PASSWORD_RESET_SECRET"],
        message: "AUTH_PASSWORD_RESET_SECRET must differ from AUTH_SESSION_SECRET.",
      });
    }

    if (environment.RESET_SMS_ENABLED) {
      for (const field of [
        "TWILIO_RESET_ACCOUNT_SID",
        "TWILIO_RESET_AUTH_TOKEN",
        "TWILIO_RESET_FROM_NUMBER",
      ] as const) {
        if (!environment[field]) addRequiredIssue(context, field, field);
      }
      if (
        environment.TWILIO_RESET_ACCOUNT_SID &&
        !/^AC[0-9a-fA-F]{32}$/u.test(environment.TWILIO_RESET_ACCOUNT_SID)
      ) {
        context.addIssue({
          code: "custom",
          path: ["TWILIO_RESET_ACCOUNT_SID"],
          message: "TWILIO_RESET_ACCOUNT_SID must be a Twilio account SID.",
        });
      }
    }

    if (environment.MBWAY_ENABLED) {
      const requiredFields = [
        ["MBWAY_API_URL", "MBWAY_API_URL"],
        ["MBWAY_MERCHANT_ID", "MBWAY_MERCHANT_ID"],
        ["MBWAY_API_KEY", "MBWAY_API_KEY"],
        ["MBWAY_WEBHOOK_SECRET", "MBWAY_WEBHOOK_SECRET"],
      ] as const;

      for (const [path, label] of requiredFields) {
        if (!environment[path]) {
          addRequiredIssue(context, path, label);
        }
      }
    }

    if (environment.WHATSAPP_ENABLED) {
      const requiredFields = [
        ["WHATSAPP_API_URL", "WHATSAPP_API_URL"],
        ["WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_PHONE_NUMBER_ID"],
        ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_ACCESS_TOKEN"],
        ["WHATSAPP_EMPLOYER_NUMBER", "WHATSAPP_EMPLOYER_NUMBER"],
      ] as const;

      for (const [path, label] of requiredFields) {
        if (!environment[path]) {
          addRequiredIssue(context, path, label);
        }
      }
    }
  });

export type ServerEnvironment = z.output<typeof serverEnvironmentSchema>;

export function parseServerEnvironment(source: unknown): ServerEnvironment {
  const result = serverEnvironmentSchema.safeParse(source);

  if (!result.success) {
    throw new EnvironmentValidationError("server", result.error.issues);
  }

  return Object.freeze(result.data);
}
