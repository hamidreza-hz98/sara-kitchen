import "server-only";

import { Types } from "mongoose";
import type { Connection } from "mongoose";

import { createActorMetadata } from "@/server/database/schema";

import {
  getPageSeoModel,
  type PageSeoTranslation,
  type SeoOpenGraphData,
  type SeoRobotsDirectives,
  type SeoStructuredData,
  type SeoTwitterData,
} from "../model/page-seo";
import { STATIC_SEO_PAGES, type StaticSeoPageKey } from "../policy/static-pages";

export type StaticSeoSnapshot = Readonly<{
  id: string;
  key: StaticSeoPageKey;
  path: string;
  slug: string;
  translations: readonly PageSeoTranslation[];
  canonicalUrl: string | null;
  robots: SeoRobotsDirectives;
  openGraph: SeoOpenGraphData;
  twitter: SeoTwitterData;
  shareImageMediaId: string | null;
  structuredData: SeoStructuredData;
  active: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}>;

export type StaticSeoWrite = Omit<
  StaticSeoSnapshot,
  "id" | "key" | "path" | "slug" | "version" | "createdAt" | "updatedAt"
>;

export class StaticSeoRepositoryConflictError extends Error {
  constructor() {
    super("static_seo_conflict");
    this.name = "StaticSeoRepositoryConflictError";
  }
}

export interface StaticSeoRepository {
  list(): Promise<readonly StaticSeoSnapshot[]>;
  findByKey(key: StaticSeoPageKey): Promise<StaticSeoSnapshot | null>;
  create(key: StaticSeoPageKey, value: StaticSeoWrite, actorId: string): Promise<StaticSeoSnapshot>;
  save(
    current: StaticSeoSnapshot,
    value: StaticSeoWrite,
    actorId: string,
  ): Promise<StaticSeoSnapshot>;
}

type PageSeoDocument = InstanceType<ReturnType<typeof getPageSeoModel>>;

function snapshot(document: PageSeoDocument): StaticSeoSnapshot {
  if (!document.staticPageKey || !Object.hasOwn(STATIC_SEO_PAGES, document.staticPageKey)) {
    throw new TypeError("Static SEO document contains an unsupported page key.");
  }
  return {
    id: document._id.toHexString(),
    key: document.staticPageKey as StaticSeoPageKey,
    path: document.path,
    slug: document.slug,
    translations: document.translations.map((entry) => ({
      locale: entry.locale,
      title: entry.title,
      description: entry.description,
      keywords: [...entry.keywords],
      openGraph: {
        title: entry.openGraph.title,
        description: entry.openGraph.description,
      },
      twitter: {
        title: entry.twitter.title,
        description: entry.twitter.description,
      },
    })),
    canonicalUrl: document.canonicalUrl,
    robots: {
      index: document.robots.index,
      follow: document.robots.follow,
      noArchive: document.robots.noArchive,
      noImageIndex: document.robots.noImageIndex,
      noSnippet: document.robots.noSnippet,
      maxSnippet: document.robots.maxSnippet,
      maxImagePreview: document.robots.maxImagePreview,
      maxVideoPreview: document.robots.maxVideoPreview,
    },
    openGraph: {
      type: document.openGraph.type,
      siteName: document.openGraph.siteName,
    },
    twitter: {
      card: document.twitter.card,
      site: document.twitter.site,
      creator: document.twitter.creator,
    },
    shareImageMediaId: document.shareImageMediaId?.toHexString() ?? null,
    structuredData: {
      types: [...document.structuredData.types],
      inputs: structuredClone(document.structuredData.inputs),
    },
    active: document.active,
    version: Number(document.get("__v") ?? 0),
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

function applyWrite(document: PageSeoDocument, value: StaticSeoWrite): void {
  document.translations = value.translations.map((entry) => structuredClone(entry));
  document.canonicalUrl = value.canonicalUrl;
  document.robots = structuredClone(value.robots);
  document.openGraph = structuredClone(value.openGraph);
  document.twitter = structuredClone(value.twitter);
  document.shareImageMediaId = value.shareImageMediaId
    ? new Types.ObjectId(value.shareImageMediaId)
    : null;
  document.structuredData = structuredClone(value.structuredData);
  document.active = value.active;
  document.manualOverrides = {
    root: ["route", "canonicalUrl", "shareImage", "openGraphType", "structuredData"],
    translations: value.translations.map((entry) => ({
      locale: entry.locale,
      fields: [
        "title",
        "description",
        "keywords",
        "openGraphTitle",
        "openGraphDescription",
        "twitterTitle",
        "twitterDescription",
      ],
    })),
  };
}

function conflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (("code" in error && error.code === 11000) ||
      ("name" in error && error.name === "VersionError"))
  );
}

export function createStaticSeoRepository(connection: Connection): StaticSeoRepository {
  const PageSeo = getPageSeoModel(connection);
  return {
    async list() {
      const documents = await PageSeo.find({ targetType: "static", deletedAt: null }).sort({
        path: 1,
        _id: 1,
      });
      return documents.map(snapshot);
    },
    async findByKey(key) {
      const document = await PageSeo.findOne({
        targetType: "static",
        staticPageKey: key,
        deletedAt: null,
      });
      return document ? snapshot(document) : null;
    },
    async create(key, value, actorId) {
      const route = STATIC_SEO_PAGES[key];
      const document = new PageSeo({
        targetType: "static",
        staticPageKey: key,
        targetKey: `static:${key}`,
        path: route.path,
        slug: route.slug,
        createdBy: createActorMetadata("admin", actorId),
        updatedBy: createActorMetadata("admin", actorId),
      });
      applyWrite(document, value);
      try {
        await document.save();
      } catch (error) {
        if (conflict(error)) throw new StaticSeoRepositoryConflictError();
        throw error;
      }
      return snapshot(document);
    },
    async save(current, value, actorId) {
      const document = await PageSeo.findById(current.id);
      if (!document || document.get("__v") !== current.version) {
        throw new StaticSeoRepositoryConflictError();
      }
      applyWrite(document, value);
      document.updatedBy = createActorMetadata("admin", actorId);
      try {
        await document.save();
      } catch (error) {
        if (conflict(error)) throw new StaticSeoRepositoryConflictError();
        throw error;
      }
      return snapshot(document);
    },
  };
}
