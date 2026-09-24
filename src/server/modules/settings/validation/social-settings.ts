import { z } from "zod";

import { SUPPORTED_LOCALES, type SupportedLocale } from "@/constants";

export const SOCIAL_PLATFORMS = [
  "instagram",
  "facebook",
  "whatsapp",
  "telegram",
  "linkedin",
  "youtube",
  "tiktok",
  "x",
  "threads",
  "pinterest",
  "snapchat",
] as const;
export const SOCIAL_ICON_KEYS = [...SOCIAL_PLATFORMS, "external-link"] as const;
export const SOCIAL_MAX_LINKS = 20;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
export type SocialIconKey = (typeof SOCIAL_ICON_KEYS)[number];

const PLATFORM_HOSTS: Readonly<Record<SocialPlatform, readonly string[]>> = Object.freeze({
  instagram: ["instagram.com", "www.instagram.com"],
  facebook: ["facebook.com", "www.facebook.com"],
  whatsapp: ["wa.me", "api.whatsapp.com"],
  telegram: ["t.me", "telegram.me"],
  linkedin: ["linkedin.com", "www.linkedin.com"],
  youtube: ["youtube.com", "www.youtube.com", "youtu.be"],
  tiktok: ["tiktok.com", "www.tiktok.com"],
  x: ["x.com", "www.x.com", "twitter.com", "www.twitter.com"],
  threads: ["threads.net", "www.threads.net"],
  pinterest: ["pinterest.com", "www.pinterest.com"],
  snapchat: ["snapchat.com", "www.snapchat.com"],
});

const itemIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u, "Use a stable lowercase kebab-case identifier.");
const standardHandleSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^@?[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?$/u, "Invalid social handle.");
const whatsappHandleSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/u, "WhatsApp handles must use E.164 format.");

function safePlatformUrl(value: string, platform: SocialPlatform): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      PLATFORM_HOSTS[platform].includes(url.hostname.toLowerCase()) &&
      ![...url.searchParams.keys()].some((key) =>
        /^(?:api[-_]?key|access[-_]?token|token|secret|signature)$/iu.test(key),
      )
    );
  } catch {
    return false;
  }
}

const urlDestinationSchema = z
  .object({ type: z.literal("url"), url: z.string().trim().min(1).max(2_048) })
  .strict();
const handleDestinationSchema = z
  .object({ type: z.literal("handle"), handle: z.string().trim().min(1).max(100) })
  .strict();

const socialLinkSchema = z
  .object({
    id: itemIdSchema,
    platform: z.enum(SOCIAL_PLATFORMS),
    destination: z.discriminatedUnion("type", [urlDestinationSchema, handleDestinationSchema]),
    iconKey: z.enum(SOCIAL_ICON_KEYS),
    active: z.boolean(),
    order: z.number().int().min(0).max(9_999),
  })
  .strict()
  .superRefine((link, context) => {
    if (link.destination.type === "url") {
      if (!safePlatformUrl(link.destination.url, link.platform)) {
        context.addIssue({
          code: "custom",
          message: "URL must use HTTPS and an allow-listed host for the selected platform.",
          path: ["destination", "url"],
        });
      }
      return;
    }
    const valid =
      link.platform === "whatsapp"
        ? whatsappHandleSchema.safeParse(link.destination.handle).success
        : standardHandleSchema.safeParse(link.destination.handle).success;
    if (!valid) {
      context.addIssue({
        code: "custom",
        message:
          link.platform === "whatsapp"
            ? "WhatsApp handles must use E.164 format."
            : "Invalid handle for the selected platform.",
        path: ["destination", "handle"],
      });
    }
  });

export const socialSettingsDataSchema = z
  .object({ links: z.array(socialLinkSchema).max(SOCIAL_MAX_LINKS) })
  .strict()
  .superRefine(({ links }, context) => {
    const ids = links.map(({ id }) => id);
    const orders = links.map(({ order }) => order);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        message: "Social link IDs must be unique.",
        path: ["links"],
      });
    }
    if (new Set(orders).size !== orders.length) {
      context.addIssue({
        code: "custom",
        message: "Social link order values must be unique.",
        path: ["links"],
      });
    }
  });

export const socialSettingsTranslationValueSchema = z
  .object({
    labels: z
      .array(z.object({ id: itemIdSchema, label: z.string().trim().min(1).max(100) }).strict())
      .max(SOCIAL_MAX_LINKS),
  })
  .strict();

const translationSchema = z
  .object({ locale: z.enum(SUPPORTED_LOCALES), value: socialSettingsTranslationValueSchema })
  .strict();

export const socialSettingsPayloadSchema = z
  .object({
    data: socialSettingsDataSchema,
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
        message: "Canonical English social labels are required.",
        path: ["translations"],
      });
    }
    const configuredIds = new Set(payload.data.links.map(({ id }) => id));
    for (const [index, translation] of payload.translations.entries()) {
      const labelIds = translation.value.labels.map(({ id }) => id);
      if (
        labelIds.length !== new Set(labelIds).size ||
        labelIds.some((id) => !configuredIds.has(id))
      ) {
        context.addIssue({
          code: "custom",
          message: "Labels must be unique and reference configured social links.",
          path: ["translations", index, "value", "labels"],
        });
      }
      if (translation.locale === "en" && labelIds.length !== configuredIds.size) {
        context.addIssue({
          code: "custom",
          message: "Canonical English must label every configured social link.",
          path: ["translations", index, "value", "labels"],
        });
      }
    }
  });

export type SocialSettingsData = z.infer<typeof socialSettingsDataSchema>;
export type SocialSettingsTranslationValue = z.infer<typeof socialSettingsTranslationValueSchema>;
export type SocialSettingsPayload = z.infer<typeof socialSettingsPayloadSchema>;
export type SocialSettingsTranslation = Readonly<{
  locale: SupportedLocale;
  value: SocialSettingsTranslationValue;
}>;

export function parseSocialSettings(value: unknown): SocialSettingsPayload {
  return socialSettingsPayloadSchema.parse(value);
}
