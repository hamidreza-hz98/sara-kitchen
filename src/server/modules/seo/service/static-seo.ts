import "server-only";

import { hasAdminPermission, type AdminRole } from "@/constants/admin-access";
import { tagsForContentChange, type CacheTag } from "@/server/cache";

import type { PageSeoTranslation } from "../model/page-seo";
import type {
  StaticSeoRepository,
  StaticSeoSnapshot,
  StaticSeoWrite,
} from "../repository/static-seo";
import type { SeoStructuredDataType } from "../model/page-seo";
import type { StaticSeoPageKey } from "../policy/static-pages";
import {
  staticSeoCreateSchema,
  staticSeoUpdateSchema,
  type StaticSeoCreateInput,
  type StaticSeoUpdateInput,
} from "../validation/static-seo-request";

export type StaticSeoActor = Readonly<{ id: string; role: AdminRole }>;
export type StaticSeoAction = "create" | "read" | "update";
export type StaticSeoAuditEvent = Readonly<{
  action: StaticSeoAction;
  actorId: string;
  key: StaticSeoPageKey | null;
  outcome: "success" | "failure" | "denied";
}>;

export type StaticSeoServiceDependencies = Readonly<{
  repository: StaticSeoRepository;
  validateShareImage(mediaId: string | null): Promise<void>;
  audit(event: StaticSeoAuditEvent): Promise<void>;
  invalidate(tag: CacheTag): void;
}>;

export class StaticSeoServiceError extends Error {
  constructor(readonly code: "forbidden" | "invalid_input" | "not_found" | "conflict") {
    super(code);
    this.name = "StaticSeoServiceError";
  }
}

function requirePermission(actor: StaticSeoActor, action: StaticSeoAction): void {
  const permission =
    action === "create" ? "seo:create" : action === "update" ? "seo:update" : "seo:read";
  if (!hasAdminPermission({ role: actor.role, active: true }, permission)) {
    throw new StaticSeoServiceError("forbidden");
  }
}

function translation(input: StaticSeoCreateInput["translations"][number]): PageSeoTranslation {
  return {
    locale: input.locale,
    title: input.title.trim(),
    description: input.description.trim(),
    keywords: [...(input.keywords ?? [])],
    openGraph: {
      title: input.openGraph?.title?.trim() || null,
      description: input.openGraph?.description?.trim() || null,
    },
    twitter: {
      title: input.twitter?.title?.trim() || null,
      description: input.twitter?.description?.trim() || null,
    },
  };
}

function defaultStructuredTypes(key: StaticSeoPageKey): readonly SeoStructuredDataType[] {
  if (key === "home") return ["web-page", "website", "organization"];
  if (key === "menu") return ["web-page", "menu", "breadcrumb-list"];
  if (key === "faq") return ["web-page", "faq-page", "breadcrumb-list"];
  return ["web-page", "breadcrumb-list"];
}

function defaults(input: StaticSeoCreateInput): StaticSeoWrite {
  return {
    translations: input.translations.map(translation),
    canonicalUrl: input.canonicalUrl ?? null,
    robots: {
      index: input.robots?.index ?? true,
      follow: input.robots?.follow ?? true,
      noArchive: input.robots?.noArchive ?? false,
      noImageIndex: input.robots?.noImageIndex ?? false,
      noSnippet: input.robots?.noSnippet ?? false,
      maxSnippet: input.robots?.maxSnippet ?? -1,
      maxImagePreview: input.robots?.maxImagePreview ?? "large",
      maxVideoPreview: input.robots?.maxVideoPreview ?? -1,
    },
    openGraph: {
      type: input.openGraph?.type ?? "website",
      siteName: input.openGraph?.siteName?.trim() || null,
    },
    twitter: {
      card: input.twitter?.card ?? "summary_large_image",
      site: input.twitter?.site ?? null,
      creator: input.twitter?.creator ?? null,
    },
    shareImageMediaId: input.shareImageMediaId ?? null,
    structuredData: {
      types: [...(input.structuredData?.types ?? defaultStructuredTypes(input.key))],
      inputs: structuredClone(input.structuredData?.inputs ?? {}) as Record<string, unknown>,
    },
    active: input.active ?? true,
  };
}

function merge(current: StaticSeoSnapshot, input: StaticSeoUpdateInput): StaticSeoWrite {
  const base: StaticSeoCreateInput = {
    key: current.key,
    translations: (input.translations ?? current.translations).map((entry) => ({
      locale: entry.locale,
      title: entry.title,
      description: entry.description,
      keywords: [...(entry.keywords ?? [])],
      openGraph: entry.openGraph ? { ...entry.openGraph } : undefined,
      twitter: entry.twitter ? { ...entry.twitter } : undefined,
    })),
    canonicalUrl: input.canonicalUrl === undefined ? current.canonicalUrl : input.canonicalUrl,
    robots: { ...current.robots, ...input.robots },
    openGraph: { ...current.openGraph, ...input.openGraph },
    twitter: { ...current.twitter, ...input.twitter },
    shareImageMediaId:
      input.shareImageMediaId === undefined ? current.shareImageMediaId : input.shareImageMediaId,
    structuredData: {
      types: input.structuredData?.types ?? current.structuredData.types,
      inputs: input.structuredData?.inputs ?? current.structuredData.inputs,
    },
    active: input.active ?? current.active,
  };
  return defaults(base);
}

async function execute<T>(
  deps: StaticSeoServiceDependencies,
  actor: StaticSeoActor,
  action: StaticSeoAction,
  key: StaticSeoPageKey | null,
  work: () => Promise<T>,
): Promise<T> {
  try {
    requirePermission(actor, action);
    const value = await work();
    if (action !== "read" && key) {
      for (const tag of tagsForContentChange({ area: "seo", ids: [key] })) deps.invalidate(tag);
    }
    await deps.audit({ action, actorId: actor.id, key, outcome: "success" });
    return value;
  } catch (error) {
    await deps.audit({
      action,
      actorId: actor.id,
      key,
      outcome:
        error instanceof StaticSeoServiceError && error.code === "forbidden" ? "denied" : "failure",
    });
    throw error;
  }
}

export function createStaticSeoServices(deps: StaticSeoServiceDependencies) {
  return {
    list(actor: StaticSeoActor) {
      return execute(deps, actor, "read", null, () => deps.repository.list());
    },
    get(actor: StaticSeoActor, key: StaticSeoPageKey) {
      return execute(deps, actor, "read", key, async () => {
        const found = await deps.repository.findByKey(key);
        if (!found) throw new StaticSeoServiceError("not_found");
        return found;
      });
    },
    create(actor: StaticSeoActor, raw: StaticSeoCreateInput) {
      return execute(deps, actor, "create", raw.key, async () => {
        const parsed = staticSeoCreateSchema.safeParse(raw);
        if (!parsed.success) throw new StaticSeoServiceError("invalid_input");
        if (await deps.repository.findByKey(parsed.data.key)) {
          throw new StaticSeoServiceError("conflict");
        }
        const value = defaults(parsed.data);
        await deps.validateShareImage(value.shareImageMediaId);
        return deps.repository.create(parsed.data.key, value, actor.id);
      });
    },
    update(actor: StaticSeoActor, key: StaticSeoPageKey, raw: StaticSeoUpdateInput) {
      return execute(deps, actor, "update", key, async () => {
        const parsed = staticSeoUpdateSchema.safeParse(raw);
        if (!parsed.success) throw new StaticSeoServiceError("invalid_input");
        const current = await deps.repository.findByKey(key);
        if (!current) throw new StaticSeoServiceError("not_found");
        const value = merge(current, parsed.data);
        await deps.validateShareImage(value.shareImageMediaId);
        return deps.repository.save(current, value, actor.id);
      });
    },
  };
}
