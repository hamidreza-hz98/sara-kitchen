import "server-only";

import type { Connection } from "mongoose";

import { createActorMetadata } from "@/server/database/schema";

import {
  getPageSeoModel,
  type PageSeoTranslation,
  type SeoEntityKind,
  type SeoManualTranslationField,
} from "../model/page-seo";
import type { EntitySeoUpdateInput } from "../validation/entity-seo-request";

export type EntitySeoSnapshot = Readonly<{
  active: boolean;
  canonicalUrl: string | null;
  entityId: string;
  entityKind: SeoEntityKind;
  id: string;
  manualOverrides: Readonly<{
    root: readonly string[];
    translations: readonly Readonly<{ locale: string; fields: readonly string[] }>[];
  }>;
  path: string;
  shareImageMediaId: string | null;
  translations: readonly PageSeoTranslation[];
  updatedAt: string;
}>;

type Document = InstanceType<ReturnType<typeof getPageSeoModel>>;

function snapshot(document: Document): EntitySeoSnapshot {
  if (!document.entityKind || !document.entityId)
    throw new TypeError("Entity SEO target is incomplete.");
  return {
    id: document._id.toHexString(),
    entityKind: document.entityKind,
    entityId: document.entityId.toHexString(),
    path: document.path,
    active: document.active,
    canonicalUrl: document.canonicalUrl,
    shareImageMediaId: document.shareImageMediaId?.toHexString() ?? null,
    translations: document.translations.map((entry) => ({
      locale: entry.locale,
      title: entry.title,
      description: entry.description,
      keywords: [...entry.keywords],
      openGraph: { ...entry.openGraph },
      twitter: { ...entry.twitter },
    })),
    manualOverrides: {
      root: [...document.manualOverrides.root],
      translations: document.manualOverrides.translations.map((entry) => ({
        locale: entry.locale,
        fields: [...entry.fields],
      })),
    },
    updatedAt: document.updatedAt.toISOString(),
  };
}

function setOverride(fields: Set<string>, field: string, manual: boolean): void {
  if (manual) fields.add(field);
  else fields.delete(field);
}

export async function findEntitySeo(
  connection: Connection,
  entityKind: SeoEntityKind,
  entityId: string,
): Promise<EntitySeoSnapshot | null> {
  const document = await getPageSeoModel(connection).findOne({
    targetKey: `entity:${entityKind}:${entityId}`,
    deletedAt: null,
  });
  return document ? snapshot(document) : null;
}

export async function applyEntitySeoOverrides(
  connection: Connection,
  entityKind: SeoEntityKind,
  entityId: string,
  input: EntitySeoUpdateInput,
  actorId: string,
): Promise<EntitySeoSnapshot | null> {
  const document = await getPageSeoModel(connection)
    .findOne({ targetKey: `entity:${entityKind}:${entityId}`, deletedAt: null })
    .select("+targetKey");
  if (!document) return null;

  const root = new Set<string>(document.manualOverrides.root);
  setOverride(root, "canonicalUrl", input.canonicalUrl.mode === "manual");
  if (input.canonicalUrl.mode === "manual")
    document.canonicalUrl = input.canonicalUrl.value ?? null;

  const overrideByLocale = new Map(
    document.manualOverrides.translations.map((entry) => [
      entry.locale,
      new Set<string>(entry.fields),
    ]),
  );
  const translationByLocale = new Map(document.translations.map((entry) => [entry.locale, entry]));
  const fields = [
    "title",
    "description",
    "keywords",
    "openGraphTitle",
    "openGraphDescription",
    "twitterTitle",
    "twitterDescription",
  ] as const;

  for (const update of input.translations) {
    const translation = translationByLocale.get(update.locale);
    if (!translation) continue;
    const overrides = overrideByLocale.get(update.locale) ?? new Set<string>();
    for (const field of fields) setOverride(overrides, field, update[field].mode === "manual");
    if (update.title.mode === "manual") translation.title = update.title.value!;
    if (update.description.mode === "manual") translation.description = update.description.value!;
    if (update.keywords.mode === "manual")
      translation.keywords = [...(update.keywords.value ?? [])];
    if (update.openGraphTitle.mode === "manual")
      translation.openGraph.title = update.openGraphTitle.value!;
    if (update.openGraphDescription.mode === "manual")
      translation.openGraph.description = update.openGraphDescription.value!;
    if (update.twitterTitle.mode === "manual")
      translation.twitter.title = update.twitterTitle.value!;
    if (update.twitterDescription.mode === "manual")
      translation.twitter.description = update.twitterDescription.value!;
    overrideByLocale.set(update.locale, overrides);
  }

  document.manualOverrides = {
    root: [...root] as never,
    translations: [...overrideByLocale.entries()].map(([locale, values]) => ({
      locale,
      fields: [...values] as SeoManualTranslationField[],
    })) as never,
  };
  document.updatedBy = createActorMetadata("admin", actorId);
  await document.save();
  return snapshot(document);
}
