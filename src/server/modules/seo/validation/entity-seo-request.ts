import "server-only";

import { z } from "zod";

import { SUPPORTED_LOCALES } from "@/constants";

import {
  SEO_ENTITY_KINDS,
  SEO_MANUAL_TRANSLATION_FIELDS,
  isSafeCanonicalUrl,
} from "../model/page-seo";

const mode = z.enum(["automatic", "manual"]);
const textField = (maximum: number) =>
  z
    .strictObject({ mode, value: z.string().trim().min(1).max(maximum).optional() })
    .superRefine((value, context) => {
      if (value.mode === "manual" && !value.value) {
        context.addIssue({
          code: "custom",
          path: ["value"],
          message: "A manual value is required.",
        });
      }
    });

const keywordsField = z
  .strictObject({
    mode,
    value: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  })
  .superRefine((value, context) => {
    if (value.mode === "manual" && !value.value) {
      context.addIssue({ code: "custom", path: ["value"], message: "A manual value is required." });
    }
    if (
      value.value &&
      new Set(value.value.map((item) => item.toLowerCase())).size !== value.value.length
    ) {
      context.addIssue({ code: "custom", path: ["value"], message: "Keywords must be unique." });
    }
  });

export const entitySeoParametersSchema = z.strictObject({
  entityKind: z.enum(SEO_ENTITY_KINDS),
  entityId: z.string().regex(/^[a-f\d]{24}$/iu),
});

export const entitySeoUpdateSchema = z.strictObject({
  translations: z
    .array(
      z.strictObject({
        locale: z.enum(SUPPORTED_LOCALES),
        title: textField(70),
        description: textField(170),
        keywords: keywordsField,
        openGraphTitle: textField(100),
        openGraphDescription: textField(220),
        twitterTitle: textField(100),
        twitterDescription: textField(220),
      }),
    )
    .min(1)
    .max(SUPPORTED_LOCALES.length)
    .refine((entries) => new Set(entries.map((entry) => entry.locale)).size === entries.length, {
      message: "Locales must be unique.",
    }),
  canonicalUrl: z
    .strictObject({
      mode,
      value: z.string().trim().refine(isSafeCanonicalUrl).nullable().optional(),
    })
    .superRefine((value, context) => {
      if (value.mode === "manual" && !value.value) {
        context.addIssue({
          code: "custom",
          path: ["value"],
          message: "A canonical URL is required.",
        });
      }
    }),
});

export const ENTITY_SEO_TRANSLATION_FIELDS = SEO_MANUAL_TRANSLATION_FIELDS;
export type EntitySeoUpdateInput = z.infer<typeof entitySeoUpdateSchema>;
