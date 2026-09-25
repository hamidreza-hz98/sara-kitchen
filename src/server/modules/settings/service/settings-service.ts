import "server-only";

import { ZodError } from "zod";

import { DEFAULT_LOCALE, type SupportedLocale } from "@/constants";
import { hasAdminPermission, type AdminPermission, type AdminRole } from "@/constants/admin-access";
import { tagsForContentChange, type CacheTag } from "@/server/cache";

import { SETTINGS_SECTION_REGISTRY } from "../model/settings-section";
import {
  SettingsRepositoryConflictError,
  type MutableSettingsSectionKey,
  type SettingsPayloadEnvelope,
  type SettingsSectionRepository,
  type SettingsSectionSnapshot,
} from "../repository/settings-section";
import { projectPublicContactSettings, type PublicContactSettings } from "./contact-public";
import { projectPublicFaqSettings, type PublicFaqSettings } from "./faq-settings";
import { projectPublicLanguageSettings, type PublicLanguageSettings } from "./language-settings";
import { projectPublicSocialSettings, type PublicSocialSettings } from "./social-public";
import { parseAboutSettings, type AboutSettingsPayload } from "../validation/about-settings";
import { parseContactSettings, type ContactSettingsPayload } from "../validation/contact-settings";
import { parseFaqSettings, type FaqSettingsPayload } from "../validation/faq-settings";
import {
  parseHomepageSettings,
  type HomepageSettingsPayload,
} from "../validation/homepage-settings";
import {
  parseLanguageSettings,
  type LanguageSettingsPayload,
} from "../validation/language-settings";
import { parseSocialSettings, type SocialSettingsPayload } from "../validation/social-settings";

export const MUTABLE_SETTINGS_SECTION_KEYS = [
  "homepage",
  "contact",
  "social",
  "about",
  "faq",
  "languages",
] as const satisfies readonly MutableSettingsSectionKey[];

export type SettingsPayloadByKey = Readonly<{
  homepage: HomepageSettingsPayload;
  contact: ContactSettingsPayload;
  social: SocialSettingsPayload;
  about: AboutSettingsPayload;
  faq: FaqSettingsPayload;
  languages: LanguageSettingsPayload;
}>;

export type PublicSettingsByKey = Readonly<{
  homepage: HomepageSettingsPayload;
  contact: PublicContactSettings;
  social: PublicSocialSettings;
  about: AboutSettingsPayload;
  faq: PublicFaqSettings;
  languages: PublicLanguageSettings;
}>;

export type SettingsActor = Readonly<{ id: string; role: AdminRole }>;
export type SettingsAction = "read" | "update" | "publish";
export type SettingsDiffSummary = Readonly<{
  changedPathCount: number;
  changedPaths: readonly string[];
  fromRevision: number | null;
  toRevision: number | null;
  truncated: boolean;
}>;
export type SettingsAuditEvent = Readonly<{
  action: SettingsAction;
  actorId: string;
  key: MutableSettingsSectionKey;
  outcome: "success" | "failure" | "denied";
  publication: "admin-read" | "draft" | "published";
  summary: SettingsDiffSummary | null;
}>;

export interface SettingsPublicCache {
  read<Value>(
    key: MutableSettingsSectionKey,
    variant: string,
    load: () => Promise<Value>,
  ): Promise<Value>;
}

export type SettingsServiceDependencies = Readonly<{
  repository: SettingsSectionRepository;
  cache: SettingsPublicCache;
  audit(event: SettingsAuditEvent): Promise<void>;
  invalidate(tag: CacheTag): void;
  now?(): Date;
}>;

export class SettingsServiceError extends Error {
  constructor(
    readonly code: "conflict" | "forbidden" | "invalid_input" | "not_found" | "not_publishable",
  ) {
    super(code);
    this.name = "SettingsServiceError";
  }
}

const UPDATE_PERMISSION = Object.freeze({
  homepage: "settings:update-content",
  about: "settings:update-content",
  faq: "settings:update-content",
  contact: "settings:update-operations",
  social: "settings:update-operations",
  languages: "settings:update-operations",
} as const satisfies Record<MutableSettingsSectionKey, AdminPermission>);

function requirePermission(
  actor: SettingsActor,
  action: SettingsAction,
  key: MutableSettingsSectionKey,
): void {
  const permission = action === "read" ? "settings:read" : UPDATE_PERMISSION[key];
  if (!hasAdminPermission({ role: actor.role, active: true }, permission)) {
    throw new SettingsServiceError("forbidden");
  }
}

export function parseSettingsPayload<Key extends MutableSettingsSectionKey>(
  key: Key,
  input: unknown,
): SettingsPayloadByKey[Key] {
  try {
    const parsed =
      key === "homepage"
        ? parseHomepageSettings(input)
        : key === "contact"
          ? parseContactSettings(input)
          : key === "social"
            ? parseSocialSettings(input)
            : key === "about"
              ? parseAboutSettings(input)
              : key === "faq"
                ? parseFaqSettings(input)
                : parseLanguageSettings(input);
    return parsed as SettingsPayloadByKey[Key];
  } catch (error) {
    if (error instanceof ZodError) throw new SettingsServiceError("invalid_input");
    throw error;
  }
}

function envelope<Key extends MutableSettingsSectionKey>(
  payload: SettingsPayloadByKey[Key],
): SettingsPayloadEnvelope {
  return structuredClone(payload) as SettingsPayloadEnvelope;
}

const MAX_DIFF_PATHS = 24;

function comparable(value: unknown): string {
  return JSON.stringify(value);
}

/** Produces bounded field paths only; values and translated/customer-facing copy never enter logs. */
export function summarizeSettingsDiff(
  previous: SettingsPayloadEnvelope | null,
  next: SettingsPayloadEnvelope,
  fromRevision: number | null,
  toRevision: number | null,
): SettingsDiffSummary {
  const paths: string[] = [];
  const previousData = previous?.data ?? {};
  for (const key of new Set([...Object.keys(previousData), ...Object.keys(next.data)])) {
    if (comparable(previousData[key]) !== comparable(next.data[key])) paths.push(`data.${key}`);
  }
  const previousTranslations = new Map(
    previous?.translations.map(({ locale, value }) => [locale, value]) ?? [],
  );
  const nextTranslations = new Map(next.translations.map(({ locale, value }) => [locale, value]));
  for (const locale of new Set([...previousTranslations.keys(), ...nextTranslations.keys()])) {
    if (comparable(previousTranslations.get(locale)) !== comparable(nextTranslations.get(locale))) {
      paths.push(`translations.${locale}`);
    }
  }
  paths.sort();
  return {
    changedPathCount: paths.length,
    changedPaths: paths.slice(0, MAX_DIFF_PATHS),
    fromRevision,
    toRevision,
    truncated: paths.length > MAX_DIFF_PATHS,
  };
}

function asServiceError(error: unknown): unknown {
  return error instanceof SettingsRepositoryConflictError
    ? new SettingsServiceError("conflict")
    : error;
}

function typedPublished<Key extends MutableSettingsSectionKey>(
  key: Key,
  section: SettingsSectionSnapshot | null,
): SettingsPayloadByKey[Key] | null {
  return section?.published ? parseSettingsPayload(key, section.published.payload) : null;
}

function projectPublic<Key extends MutableSettingsSectionKey>(
  key: Key,
  payload: SettingsPayloadByKey[Key],
  locale: SupportedLocale,
  fallbackLocale?: SupportedLocale | null,
): PublicSettingsByKey[Key] {
  const projected =
    key === "contact"
      ? projectPublicContactSettings(payload as ContactSettingsPayload, locale, fallbackLocale)
      : key === "social"
        ? projectPublicSocialSettings(payload as SocialSettingsPayload, locale, fallbackLocale)
        : key === "faq"
          ? projectPublicFaqSettings(payload as FaqSettingsPayload, locale, fallbackLocale)
          : key === "languages"
            ? projectPublicLanguageSettings(
                payload as LanguageSettingsPayload,
                locale,
                fallbackLocale,
              )
            : payload;
  return projected as PublicSettingsByKey[Key];
}

export function createSettingsServices(deps: SettingsServiceDependencies) {
  const now = deps.now ?? (() => new Date());

  async function auditFailure(
    actor: SettingsActor,
    action: SettingsAction,
    key: MutableSettingsSectionKey,
    error: unknown,
    publication: SettingsAuditEvent["publication"],
  ) {
    await deps.audit({
      action,
      actorId: actor.id,
      key,
      outcome:
        error instanceof SettingsServiceError && error.code === "forbidden" ? "denied" : "failure",
      publication,
      summary: null,
    });
  }

  async function invalidate(key: MutableSettingsSectionKey) {
    for (const tag of tagsForContentChange({ area: "settings", ids: [key] })) {
      deps.invalidate(tag);
    }
  }

  return {
    async getAdmin<Key extends MutableSettingsSectionKey>(
      actor: SettingsActor,
      key: Key,
    ): Promise<SettingsSectionSnapshot | null> {
      try {
        requirePermission(actor, "read", key);
        const section = await deps.repository.findByKey(key);
        if (section?.draft) parseSettingsPayload(key, section.draft.payload);
        if (section?.published) parseSettingsPayload(key, section.published.payload);
        await deps.audit({
          action: "read",
          actorId: actor.id,
          key,
          outcome: "success",
          publication: "admin-read",
          summary: null,
        });
        return section;
      } catch (caught) {
        const error = asServiceError(caught);
        await auditFailure(actor, "read", key, error, "admin-read");
        throw error;
      }
    },

    async getPublic<Key extends MutableSettingsSectionKey>(
      key: Key,
      locale: SupportedLocale = DEFAULT_LOCALE,
      fallbackLocale?: SupportedLocale | null,
    ): Promise<PublicSettingsByKey[Key] | null> {
      const variant = `${locale}:${fallbackLocale ?? "canonical"}`;
      return deps.cache.read(key, variant, async () => {
        const payload = typedPublished(key, await deps.repository.findByKey(key));
        return payload ? projectPublic(key, payload, locale, fallbackLocale) : null;
      });
    },

    async update<Key extends MutableSettingsSectionKey>(
      actor: SettingsActor,
      key: Key,
      input: unknown,
    ): Promise<SettingsSectionSnapshot> {
      const publication =
        SETTINGS_SECTION_REGISTRY[key].publicationPolicy === "direct" ? "published" : "draft";
      try {
        requirePermission(actor, "update", key);
        const payload = parseSettingsPayload(key, input);
        const current = await deps.repository.findByKey(key);
        const previous =
          publication === "draft"
            ? (current?.draft ?? current?.published ?? null)
            : (current?.published ?? null);
        const updated =
          publication === "draft"
            ? await deps.repository.saveDraft(current, key, envelope(payload), actor.id, now())
            : await deps.repository.saveDirect(current, key, envelope(payload), actor.id, now());
        const nextRevision = publication === "draft" ? updated.draft : updated.published;
        const summary = summarizeSettingsDiff(
          previous?.payload ?? null,
          nextRevision?.payload ?? envelope(payload),
          previous?.revision ?? null,
          nextRevision?.revision ?? null,
        );
        try {
          await deps.audit({
            action: "update",
            actorId: actor.id,
            key,
            outcome: "success",
            publication,
            summary,
          });
        } finally {
          if (publication === "published") await invalidate(key);
        }
        return updated;
      } catch (caught) {
        const error = asServiceError(caught);
        await auditFailure(actor, "update", key, error, publication);
        throw error;
      }
    },

    async publish(
      actor: SettingsActor,
      key: MutableSettingsSectionKey,
    ): Promise<SettingsSectionSnapshot> {
      try {
        requirePermission(actor, "publish", key);
        if (SETTINGS_SECTION_REGISTRY[key].publicationPolicy !== "staged") {
          throw new SettingsServiceError("not_publishable");
        }
        const current = await deps.repository.findByKey(key);
        if (!current?.draft) throw new SettingsServiceError("not_found");
        parseSettingsPayload(key, current.draft.payload);
        const updated = await deps.repository.publishDraft(current, actor.id, now());
        const summary = summarizeSettingsDiff(
          current.published?.payload ?? null,
          current.draft.payload,
          current.published?.revision ?? null,
          updated.published?.revision ?? null,
        );
        try {
          await deps.audit({
            action: "publish",
            actorId: actor.id,
            key,
            outcome: "success",
            publication: "published",
            summary,
          });
        } finally {
          await invalidate(key);
        }
        return updated;
      } catch (caught) {
        const error = asServiceError(caught);
        await auditFailure(actor, "publish", key, error, "published");
        throw error;
      }
    },
  };
}
