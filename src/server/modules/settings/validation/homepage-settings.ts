import { z } from "zod";

import { SUPPORTED_LOCALES, type SupportedLocale } from "@/constants";

export const HOMEPAGE_MAX_FEATURED_DISHES = 6;
export const HOMEPAGE_MAX_HERO_SLIDES = 8;
export const HOMEPAGE_MAX_BANNERS = 8;
export const HOMEPAGE_MAX_BENEFITS = 12;
export const HOMEPAGE_MAX_TESTIMONIALS = 12;
export const HOMEPAGE_MAX_CATEGORY_BANNERS = 12;
export const HOMEPAGE_MAX_DISCOUNTED_DISHES = 12;
export const HOMEPAGE_MAX_BLOGS = 12;

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/iu, "Must be a valid ObjectId.");
const itemIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u, "Use a stable lowercase kebab-case identifier.");

const safeLinkSchema = z
  .string()
  .trim()
  .max(2_048)
  .refine((value) => {
    if (value.startsWith("/") && !value.startsWith("//")) {
      return !value.startsWith("/dashboard") && !value.startsWith("/api");
    }
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Use a public internal path or an HTTPS URL without credentials.");

const optionalText = (maximum: number) => z.string().trim().max(maximum).default("");
const requiredText = (maximum: number) => z.string().trim().min(1).max(maximum);

const heroSlideSchema = z
  .object({
    id: itemIdSchema,
    imageMediaId: objectIdSchema,
    mobileImageMediaId: objectIdSchema.nullable().default(null),
    href: safeLinkSchema.nullable().default(null),
    openInNewTab: z.boolean().default(false),
    enabled: z.boolean().default(true),
  })
  .strict();

const linkedBannerSchema = z
  .object({
    id: itemIdSchema,
    imageMediaId: objectIdSchema,
    href: safeLinkSchema,
    openInNewTab: z.boolean().default(false),
    enabled: z.boolean().default(true),
  })
  .strict();

const benefitSchema = z
  .object({
    id: itemIdSchema,
    iconMediaId: objectIdSchema.nullable().default(null),
    enabled: z.boolean().default(true),
  })
  .strict();

const testimonialSchema = z
  .object({
    id: itemIdSchema,
    avatarMediaId: objectIdSchema.nullable().default(null),
    rating: z.number().int().min(1).max(5),
    enabled: z.boolean().default(true),
  })
  .strict();

const categoryBannerSchema = z
  .object({
    categoryId: objectIdSchema,
    imageMediaId: objectIdSchema.nullable().default(null),
    enabled: z.boolean().default(true),
  })
  .strict();

export const homepageSettingsDataSchema = z
  .object({
    heroSlides: z.array(heroSlideSchema).max(HOMEPAGE_MAX_HERO_SLIDES),
    linkedBanners: z.array(linkedBannerSchema).max(HOMEPAGE_MAX_BANNERS),
    featuredDishIds: z.array(objectIdSchema).max(HOMEPAGE_MAX_FEATURED_DISHES),
    benefits: z.array(benefitSchema).max(HOMEPAGE_MAX_BENEFITS),
    testimonials: z.array(testimonialSchema).max(HOMEPAGE_MAX_TESTIMONIALS),
    categoryBanners: z.array(categoryBannerSchema).max(HOMEPAGE_MAX_CATEGORY_BANNERS),
    discountedSection: z
      .object({
        enabled: z.boolean(),
        mode: z.enum(["automatic", "curated"]),
        dishIds: z.array(objectIdSchema).max(HOMEPAGE_MAX_DISCOUNTED_DISHES),
        limit: z.number().int().min(1).max(HOMEPAGE_MAX_DISCOUNTED_DISHES),
      })
      .strict(),
    blogIds: z.array(objectIdSchema).max(HOMEPAGE_MAX_BLOGS),
  })
  .strict()
  .superRefine((value, context) => {
    const unique = (values: readonly string[], path: (string | number)[]) => {
      if (new Set(values).size !== values.length) {
        context.addIssue({ code: "custom", message: "Values must be unique.", path });
      }
    };
    unique(
      value.heroSlides.map(({ id }) => id),
      ["heroSlides"],
    );
    unique(
      value.linkedBanners.map(({ id }) => id),
      ["linkedBanners"],
    );
    unique(value.featuredDishIds, ["featuredDishIds"]);
    unique(
      value.benefits.map(({ id }) => id),
      ["benefits"],
    );
    unique(
      value.testimonials.map(({ id }) => id),
      ["testimonials"],
    );
    unique(
      value.categoryBanners.map(({ categoryId }) => categoryId),
      ["categoryBanners"],
    );
    unique(value.discountedSection.dishIds, ["discountedSection", "dishIds"]);
    unique(value.blogIds, ["blogIds"]);
    if (
      value.discountedSection.mode === "automatic" &&
      value.discountedSection.dishIds.length > 0
    ) {
      context.addIssue({
        code: "custom",
        message: "Automatic discounted sections cannot contain curated dish IDs.",
        path: ["discountedSection", "dishIds"],
      });
    }
  });

const heroTranslationSchema = z
  .object({
    id: itemIdSchema,
    title: requiredText(120),
    description: optionalText(500),
    ctaLabel: optionalText(60),
    imageAlt: requiredText(180),
  })
  .strict();
const bannerTranslationSchema = z
  .object({ id: itemIdSchema, title: optionalText(120), imageAlt: requiredText(180) })
  .strict();
const benefitTranslationSchema = z
  .object({ id: itemIdSchema, title: requiredText(100), description: requiredText(300) })
  .strict();
const testimonialTranslationSchema = z
  .object({
    id: itemIdSchema,
    authorName: requiredText(100),
    authorRole: optionalText(100),
    quote: requiredText(600),
  })
  .strict();
const categoryBannerTranslationSchema = z
  .object({ categoryId: objectIdSchema, title: optionalText(120), imageAlt: requiredText(180) })
  .strict();

export const homepageSettingsTranslationValueSchema = z
  .object({
    heroSlides: z.array(heroTranslationSchema).max(HOMEPAGE_MAX_HERO_SLIDES),
    linkedBanners: z.array(bannerTranslationSchema).max(HOMEPAGE_MAX_BANNERS),
    benefits: z.array(benefitTranslationSchema).max(HOMEPAGE_MAX_BENEFITS),
    testimonials: z.array(testimonialTranslationSchema).max(HOMEPAGE_MAX_TESTIMONIALS),
    categoryBanners: z.array(categoryBannerTranslationSchema).max(HOMEPAGE_MAX_CATEGORY_BANNERS),
    sectionTitles: z
      .object({
        featured: requiredText(120),
        benefits: requiredText(120),
        testimonials: requiredText(120),
        categories: requiredText(120),
        discounted: requiredText(120),
        blog: requiredText(120),
      })
      .strict(),
  })
  .strict();

const translationSchema = z
  .object({
    locale: z.enum(SUPPORTED_LOCALES),
    value: homepageSettingsTranslationValueSchema,
  })
  .strict();

export const homepageSettingsPayloadSchema = z
  .object({
    data: homepageSettingsDataSchema,
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
        message: "Canonical English homepage content is required.",
        path: ["translations"],
      });
    }

    const expected = {
      heroSlides: new Set(payload.data.heroSlides.map(({ id }) => id)),
      linkedBanners: new Set(payload.data.linkedBanners.map(({ id }) => id)),
      benefits: new Set(payload.data.benefits.map(({ id }) => id)),
      testimonials: new Set(payload.data.testimonials.map(({ id }) => id)),
      categoryBanners: new Set(payload.data.categoryBanners.map(({ categoryId }) => categoryId)),
    };
    for (const [translationIndex, translation] of payload.translations.entries()) {
      for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
        const ids = translation.value[key].map((entry) =>
          "id" in entry ? entry.id : entry.categoryId,
        );
        if (ids.length !== new Set(ids).size || ids.some((id) => !expected[key].has(id))) {
          context.addIssue({
            code: "custom",
            message: "Localized entries must be unique and reference configured homepage items.",
            path: ["translations", translationIndex, "value", key],
          });
        }
        if (translation.locale === "en" && ids.length !== expected[key].size) {
          context.addIssue({
            code: "custom",
            message: "Canonical English must translate every configured homepage item.",
            path: ["translations", translationIndex, "value", key],
          });
        }
      }
    }
  });

export type HomepageSettingsData = z.infer<typeof homepageSettingsDataSchema>;
export type HomepageSettingsTranslationValue = z.infer<
  typeof homepageSettingsTranslationValueSchema
>;
export type HomepageSettingsPayload = z.infer<typeof homepageSettingsPayloadSchema>;
export type HomepageSettingsTranslation = Readonly<{
  locale: SupportedLocale;
  value: HomepageSettingsTranslationValue;
}>;

export function parseHomepageSettings(value: unknown): HomepageSettingsPayload {
  return homepageSettingsPayloadSchema.parse(value);
}
