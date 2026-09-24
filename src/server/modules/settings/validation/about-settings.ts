import { z } from "zod";

import { SUPPORTED_LOCALES, type SupportedLocale } from "@/constants";
import { isStoredRichText, type StoredRichText } from "@/lib/rich-text";

export const ABOUT_MAX_KITCHEN_MEDIA = 12;
export const ABOUT_MAX_TEAM_MEMBERS = 20;
export const ABOUT_MAX_VALUES = 12;
export const ABOUT_MAX_STORY_SECTIONS = 12;
export const ABOUT_MAX_CALLS_TO_ACTION = 3;

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/iu, "Must be a valid ObjectId.");
const itemIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u, "Use a stable lowercase kebab-case identifier.");
const requiredText = (maximum: number) => z.string().trim().min(1).max(maximum);
const optionalText = (maximum: number) => z.string().trim().max(maximum).default("");
const storedRichTextSchema = z.custom<StoredRichText>(isStoredRichText, {
  message: "Content must satisfy the versioned rich-text policy.",
});

const safeLinkSchema = z
  .string()
  .trim()
  .max(2_048)
  .refine((value) => {
    if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) {
      return !value.startsWith("/dashboard") && !value.startsWith("/api");
    }
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Use a public internal path or an HTTPS URL without credentials.");

const orderedItemFields = {
  id: itemIdSchema,
  enabled: z.boolean().default(true),
  order: z.number().int().min(0).max(9_999),
} as const;

const teamMemberSchema = z
  .object({ ...orderedItemFields, portraitMediaId: objectIdSchema })
  .strict();
const valueSchema = z
  .object({ ...orderedItemFields, iconMediaId: objectIdSchema.nullable().default(null) })
  .strict();
const storySectionSchema = z
  .object({
    ...orderedItemFields,
    mediaId: objectIdSchema.nullable().default(null),
    mediaPlacement: z.enum(["start", "end", "full"]).default("end"),
  })
  .strict();
const callToActionSchema = z
  .object({
    ...orderedItemFields,
    href: safeLinkSchema,
    openInNewTab: z.boolean().default(false),
    variant: z.enum(["primary", "secondary"]).default("primary"),
  })
  .strict();

export const aboutSettingsDataSchema = z
  .object({
    heroMediaId: objectIdSchema.nullable().default(null),
    kitchenMediaIds: z.array(objectIdSchema).max(ABOUT_MAX_KITCHEN_MEDIA),
    teamMembers: z.array(teamMemberSchema).max(ABOUT_MAX_TEAM_MEMBERS),
    values: z.array(valueSchema).max(ABOUT_MAX_VALUES),
    storySections: z.array(storySectionSchema).max(ABOUT_MAX_STORY_SECTIONS),
    callsToAction: z.array(callToActionSchema).max(ABOUT_MAX_CALLS_TO_ACTION),
  })
  .strict()
  .superRefine((data, context) => {
    const unique = (values: readonly (number | string)[], path: string[]) => {
      if (new Set(values).size !== values.length) {
        context.addIssue({ code: "custom", message: "Values must be unique.", path });
      }
    };
    unique(data.kitchenMediaIds, ["kitchenMediaIds"]);
    for (const key of ["teamMembers", "values", "storySections", "callsToAction"] as const) {
      unique(
        data[key].map(({ id }) => id),
        [key],
      );
      unique(
        data[key].map(({ order }) => order),
        [key],
      );
    }
  });

const mediaAltSchema = z.object({ mediaId: objectIdSchema, alt: requiredText(240) }).strict();
const teamMemberTranslationSchema = z
  .object({
    id: itemIdSchema,
    name: requiredText(100),
    role: optionalText(100),
    bio: optionalText(1_000),
    portraitAlt: requiredText(240),
  })
  .strict();
const valueTranslationSchema = z
  .object({ id: itemIdSchema, title: requiredText(120), description: requiredText(600) })
  .strict();
const storyTranslationSchema = z
  .object({
    id: itemIdSchema,
    title: requiredText(160),
    content: storedRichTextSchema,
    mediaAlt: optionalText(240),
  })
  .strict();
const callToActionTranslationSchema = z
  .object({ id: itemIdSchema, label: requiredText(80) })
  .strict();

export const aboutSettingsTranslationValueSchema = z
  .object({
    eyebrow: optionalText(80),
    title: requiredText(160),
    summary: requiredText(800),
    content: storedRichTextSchema,
    heroMediaAlt: optionalText(240),
    kitchenMedia: z.array(mediaAltSchema).max(ABOUT_MAX_KITCHEN_MEDIA),
    teamMembers: z.array(teamMemberTranslationSchema).max(ABOUT_MAX_TEAM_MEMBERS),
    values: z.array(valueTranslationSchema).max(ABOUT_MAX_VALUES),
    storySections: z.array(storyTranslationSchema).max(ABOUT_MAX_STORY_SECTIONS),
    callsToAction: z.array(callToActionTranslationSchema).max(ABOUT_MAX_CALLS_TO_ACTION),
  })
  .strict();

const translationSchema = z
  .object({ locale: z.enum(SUPPORTED_LOCALES), value: aboutSettingsTranslationValueSchema })
  .strict();

export const aboutSettingsPayloadSchema = z
  .object({
    data: aboutSettingsDataSchema,
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
    if (!locales.includes("en")) {
      context.addIssue({
        code: "custom",
        message: "Canonical English About content is required.",
        path: ["translations"],
      });
    }

    const expected = {
      kitchenMedia: new Set(payload.data.kitchenMediaIds),
      teamMembers: new Set(payload.data.teamMembers.map(({ id }) => id)),
      values: new Set(payload.data.values.map(({ id }) => id)),
      storySections: new Set(payload.data.storySections.map(({ id }) => id)),
      callsToAction: new Set(payload.data.callsToAction.map(({ id }) => id)),
    };
    for (const [translationIndex, translation] of payload.translations.entries()) {
      if (
        payload.data.heroMediaId &&
        translation.locale === "en" &&
        !translation.value.heroMediaAlt
      ) {
        context.addIssue({
          code: "custom",
          message: "Canonical English requires hero media alternative text.",
          path: ["translations", translationIndex, "value", "heroMediaAlt"],
        });
      }
      if (translation.locale === "en") {
        const storyIdsWithMedia = new Set(
          payload.data.storySections.filter(({ mediaId }) => mediaId).map(({ id }) => id),
        );
        translation.value.storySections.forEach((story, storyIndex) => {
          if (storyIdsWithMedia.has(story.id) && !story.mediaAlt) {
            context.addIssue({
              code: "custom",
              message: "Canonical English requires story media alternative text.",
              path: [
                "translations",
                translationIndex,
                "value",
                "storySections",
                storyIndex,
                "mediaAlt",
              ],
            });
          }
        });
      }
      for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
        const ids = translation.value[key].map((entry) =>
          "id" in entry ? entry.id : entry.mediaId,
        );
        if (ids.length !== new Set(ids).size || ids.some((id) => !expected[key].has(id))) {
          context.addIssue({
            code: "custom",
            message: "Localized entries must be unique and reference configured About items.",
            path: ["translations", translationIndex, "value", key],
          });
        }
        if (translation.locale === "en" && ids.length !== expected[key].size) {
          context.addIssue({
            code: "custom",
            message: "Canonical English must translate every configured About item.",
            path: ["translations", translationIndex, "value", key],
          });
        }
      }
    }
  });

export type AboutSettingsData = z.infer<typeof aboutSettingsDataSchema>;
export type AboutSettingsTranslationValue = z.infer<typeof aboutSettingsTranslationValueSchema>;
export type AboutSettingsPayload = z.infer<typeof aboutSettingsPayloadSchema>;
export type AboutSettingsTranslation = Readonly<{
  locale: SupportedLocale;
  value: AboutSettingsTranslationValue;
}>;

export function parseAboutSettings(value: unknown): AboutSettingsPayload {
  return aboutSettingsPayloadSchema.parse(value);
}
