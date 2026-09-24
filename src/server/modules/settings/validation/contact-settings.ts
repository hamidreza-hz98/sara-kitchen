import { z } from "zod";

import { PROJECT_TIME_ZONE, SUPPORTED_LOCALES, type SupportedLocale } from "@/constants";

export const CONTACT_WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
export const CONTACT_MAP_PROVIDERS = ["leaflet", "google_maps_embed"] as const;
export const CONTACT_MAX_PHONES = 8;

const e164Schema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/u, "Use an E.164 phone number such as +351220000000.");
const itemIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u, "Use a stable lowercase kebab-case identifier.");
const timeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u, "Use 24-hour HH:mm time.");
const requiredText = (maximum: number) => z.string().trim().min(1).max(maximum);
const optionalText = (maximum: number) => z.string().trim().max(maximum).default("");

function safeHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !hasSensitiveQueryParameter(url)
    );
  } catch {
    return false;
  }
}

function hasSensitiveQueryParameter(url: URL): boolean {
  return [...url.searchParams.keys()].some((key) =>
    /^(?:api[-_]?key|access[-_]?token|token|secret|signature)$/iu.test(key),
  );
}

function safeGoogleMapEmbed(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !hasSensitiveQueryParameter(url) &&
      ["www.google.com", "maps.google.com"].includes(url.hostname) &&
      url.pathname.startsWith("/maps/embed")
    );
  } catch {
    return false;
  }
}

function minutes(value: string): number {
  const [hour = 0, minute = 0] = value.split(":").map(Number);
  return hour * 60 + minute;
}

const hoursPeriodSchema = z
  .object({ opensAt: timeSchema, closesAt: timeSchema })
  .strict()
  .refine(({ opensAt, closesAt }) => minutes(opensAt) < minutes(closesAt), {
    message: "Business-hour periods must open before they close on the same day.",
  });

const businessDaySchema = z
  .object({
    day: z.enum(CONTACT_WEEKDAYS),
    periods: z.array(hoursPeriodSchema).max(3),
  })
  .strict()
  .superRefine(({ periods }, context) => {
    for (let index = 1; index < periods.length; index += 1) {
      const previous = periods[index - 1];
      const current = periods[index];
      if (previous && current && minutes(previous.closesAt) > minutes(current.opensAt)) {
        context.addIssue({
          code: "custom",
          message: "Business-hour periods must be ordered and cannot overlap.",
          path: ["periods", index],
        });
      }
    }
  });

const phoneSchema = z
  .object({
    id: itemIdSchema,
    kind: z.enum(["mobile", "landline"]),
    number: e164Schema,
    primary: z.boolean(),
    public: z.boolean(),
  })
  .strict();

const mapSchema = z
  .object({
    provider: z.enum(CONTACT_MAP_PROVIDERS),
    zoom: z.number().int().min(1).max(20),
    embedUrl: z.string().trim().max(2_048).nullable(),
    directionsUrl: z
      .string()
      .trim()
      .max(2_048)
      .refine(safeHttpsUrl, "Directions URL must be credential-free HTTPS.")
      .nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.provider === "leaflet" && value.embedUrl !== null) {
      context.addIssue({
        code: "custom",
        message: "Leaflet maps use coordinates and cannot store an embed URL.",
        path: ["embedUrl"],
      });
    }
    if (
      value.provider === "google_maps_embed" &&
      (value.embedUrl === null || !safeGoogleMapEmbed(value.embedUrl))
    ) {
      context.addIssue({
        code: "custom",
        message: "Google Maps requires an HTTPS google.com/maps/embed URL.",
        path: ["embedUrl"],
      });
    }
  });

export const contactSettingsDataSchema = z
  .object({
    phones: z.array(phoneSchema).min(1).max(CONTACT_MAX_PHONES),
    whatsapp: z.object({ enabled: z.boolean(), number: e164Schema }).strict(),
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    address: z
      .object({
        postalCode: z.string().trim().min(3).max(20),
        countryCode: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z]{2}$/u),
      })
      .strict(),
    location: z
      .object({
        latitude: z.number().finite().min(-90).max(90),
        longitude: z.number().finite().min(-180).max(180),
      })
      .strict(),
    serviceArea: z
      .object({
        mode: z.enum(["city", "radius"]),
        radiusKm: z.number().positive().max(200).nullable(),
      })
      .strict(),
    businessHours: z.array(businessDaySchema).length(CONTACT_WEEKDAYS.length),
    timeZone: z.literal(PROJECT_TIME_ZONE),
    map: mapSchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    const phoneIds = value.phones.map(({ id }) => id);
    const numbers = value.phones.map(({ number }) => number);
    if (new Set(phoneIds).size !== phoneIds.length) {
      context.addIssue({ code: "custom", message: "Phone IDs must be unique.", path: ["phones"] });
    }
    if (new Set(numbers).size !== numbers.length) {
      context.addIssue({
        code: "custom",
        message: "Phone numbers must be unique.",
        path: ["phones"],
      });
    }
    if (value.phones.filter(({ primary }) => primary).length !== 1) {
      context.addIssue({
        code: "custom",
        message: "Exactly one contact phone must be primary.",
        path: ["phones"],
      });
    }
    const days = value.businessHours.map(({ day }) => day);
    if (new Set(days).size !== CONTACT_WEEKDAYS.length) {
      context.addIssue({
        code: "custom",
        message: "Business hours must define every weekday exactly once.",
        path: ["businessHours"],
      });
    }
    if (value.serviceArea.mode === "city" && value.serviceArea.radiusKm !== null) {
      context.addIssue({
        code: "custom",
        message: "City service areas cannot define a radius.",
        path: ["serviceArea", "radiusKm"],
      });
    }
    if (value.serviceArea.mode === "radius" && value.serviceArea.radiusKm === null) {
      context.addIssue({
        code: "custom",
        message: "Radius service areas require radiusKm.",
        path: ["serviceArea", "radiusKm"],
      });
    }
  });

export const contactSettingsTranslationValueSchema = z
  .object({
    phoneLabels: z
      .array(z.object({ id: itemIdSchema, label: requiredText(80) }).strict())
      .max(CONTACT_MAX_PHONES),
    address: z
      .object({
        line1: requiredText(160),
        line2: optionalText(160),
        city: requiredText(100),
        region: optionalText(100),
        country: requiredText(100),
      })
      .strict(),
    serviceArea: z.object({ name: requiredText(100), description: requiredText(500) }).strict(),
    businessHoursNote: optionalText(300),
    whatsappPrefilledMessage: optionalText(500),
    mapLabel: requiredText(120),
  })
  .strict();

const translationSchema = z
  .object({ locale: z.enum(SUPPORTED_LOCALES), value: contactSettingsTranslationValueSchema })
  .strict();

export const contactSettingsPayloadSchema = z
  .object({
    data: contactSettingsDataSchema,
    translations: z.array(translationSchema).min(1).max(SUPPORTED_LOCALES.length),
  })
  .strict()
  .superRefine((payload, context) => {
    const locales = payload.translations.map(({ locale }) => locale);
    if (new Set(locales).size !== locales.length) {
      context.addIssue({
        code: "custom",
        message: "Locales must be unique.",
        path: ["translations"],
      });
    }
    const englishIndex = locales.indexOf("en");
    if (englishIndex < 0) {
      context.addIssue({
        code: "custom",
        message: "Canonical English contact content is required.",
        path: ["translations"],
      });
    }
    const configuredPhoneIds = new Set(payload.data.phones.map(({ id }) => id));
    for (const [index, translation] of payload.translations.entries()) {
      const labels = translation.value.phoneLabels.map(({ id }) => id);
      if (
        labels.length !== new Set(labels).size ||
        labels.some((id) => !configuredPhoneIds.has(id))
      ) {
        context.addIssue({
          code: "custom",
          message: "Phone labels must be unique and reference configured phones.",
          path: ["translations", index, "value", "phoneLabels"],
        });
      }
      if (translation.locale === "en" && labels.length !== configuredPhoneIds.size) {
        context.addIssue({
          code: "custom",
          message: "Canonical English must label every configured phone.",
          path: ["translations", index, "value", "phoneLabels"],
        });
      }
    }
  });

export type ContactWeekday = (typeof CONTACT_WEEKDAYS)[number];
export type ContactSettingsData = z.infer<typeof contactSettingsDataSchema>;
export type ContactSettingsTranslationValue = z.infer<typeof contactSettingsTranslationValueSchema>;
export type ContactSettingsPayload = z.infer<typeof contactSettingsPayloadSchema>;
export type ContactSettingsTranslation = Readonly<{
  locale: SupportedLocale;
  value: ContactSettingsTranslationValue;
}>;

export function parseContactSettings(value: unknown): ContactSettingsPayload {
  return contactSettingsPayloadSchema.parse(value);
}
