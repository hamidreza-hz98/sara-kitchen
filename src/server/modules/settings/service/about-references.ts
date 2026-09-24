import "server-only";

import type { Connection } from "mongoose";

import type { RichTextNode, StoredRichText } from "@/lib/rich-text";
import { getMediaReferenceFacts, type MediaReferenceFacts } from "@/server/modules/media";

import type { AboutSettingsPayload } from "../validation/about-settings";

export const ABOUT_REFERENCE_ERROR_CODES = [
  "missing",
  "wrong_media_kind",
  "media_not_ready",
] as const;

export type AboutReferenceErrorCode = (typeof ABOUT_REFERENCE_ERROR_CODES)[number];
export type AboutMediaKind = "image" | "video";
export type AboutReferenceIssue = Readonly<{
  actualKind?: string;
  code: AboutReferenceErrorCode;
  expectedKind: AboutMediaKind;
  id: string;
  path: string;
}>;
export type AboutReferenceDependencies = Readonly<{
  getMedia(ids: readonly string[]): Promise<readonly MediaReferenceFacts[]>;
}>;

type MediaUse = Readonly<{
  id: string;
  kind: AboutMediaKind;
  path: string;
}>;

export class AboutSettingsReferenceError extends Error {
  readonly issues: readonly AboutReferenceIssue[];

  constructor(issues: readonly AboutReferenceIssue[]) {
    super("about_invalid_media_references");
    this.name = "AboutSettingsReferenceError";
    this.issues = issues;
  }
}

function richTextMediaUses(content: StoredRichText, path: string): MediaUse[] {
  const uses: MediaUse[] = [];
  const visit = (nodes: readonly RichTextNode[] | undefined, parentPath: string) => {
    nodes?.forEach((node, index) => {
      const nodePath = `${parentPath}.content.${index}`;
      if (node.type === "media") {
        uses.push({ id: node.attrs.mediaId, kind: node.attrs.kind, path: nodePath });
      } else if ("content" in node) {
        visit(node.content, nodePath);
      }
    });
  };
  visit(content.document.content, `${path}.document`);
  return uses;
}

/** Collects every explicit and embedded Media dependency with its intended rendering kind. */
export function collectAboutMediaUses(payload: AboutSettingsPayload): readonly MediaUse[] {
  const uses: MediaUse[] = [];
  if (payload.data.heroMediaId) {
    uses.push({ id: payload.data.heroMediaId, kind: "image", path: "data.heroMediaId" });
  }
  payload.data.kitchenMediaIds.forEach((id, index) => {
    uses.push({ id, kind: "image", path: `data.kitchenMediaIds.${index}` });
  });
  payload.data.teamMembers.forEach(({ portraitMediaId }, index) => {
    uses.push({
      id: portraitMediaId,
      kind: "image",
      path: `data.teamMembers.${index}.portraitMediaId`,
    });
  });
  payload.data.values.forEach(({ iconMediaId }, index) => {
    if (iconMediaId) {
      uses.push({ id: iconMediaId, kind: "image", path: `data.values.${index}.iconMediaId` });
    }
  });
  payload.data.storySections.forEach(({ mediaId }, index) => {
    if (mediaId) {
      uses.push({ id: mediaId, kind: "image", path: `data.storySections.${index}.mediaId` });
    }
  });
  payload.translations.forEach((translation, translationIndex) => {
    uses.push(
      ...richTextMediaUses(
        translation.value.content,
        `translations.${translationIndex}.value.content`,
      ),
    );
    translation.value.storySections.forEach((story, storyIndex) => {
      uses.push(
        ...richTextMediaUses(
          story.content,
          `translations.${translationIndex}.value.storySections.${storyIndex}.content`,
        ),
      );
    });
  });
  return uses;
}

export async function validateAboutSettingsMediaReferences(
  payload: AboutSettingsPayload,
  dependencies: AboutReferenceDependencies,
): Promise<void> {
  const uses = collectAboutMediaUses(payload);
  const media = await dependencies.getMedia([...new Set(uses.map(({ id }) => id))]);
  const mediaById = new Map(media.map((item) => [item.id, item]));
  const issues: AboutReferenceIssue[] = [];

  for (const use of uses) {
    const item = mediaById.get(use.id);
    if (!item) {
      issues.push({ code: "missing", id: use.id, expectedKind: use.kind, path: use.path });
    } else if (item.kind !== use.kind) {
      issues.push({
        code: "wrong_media_kind",
        id: use.id,
        expectedKind: use.kind,
        actualKind: item.kind,
        path: use.path,
      });
    } else if (item.processingState !== "ready") {
      issues.push({
        code: "media_not_ready",
        id: use.id,
        expectedKind: use.kind,
        path: use.path,
      });
    }
  }
  if (issues.length > 0) throw new AboutSettingsReferenceError(issues);
}

export function createAboutReferenceDependencies(
  connection: Connection,
): AboutReferenceDependencies {
  return { getMedia: (ids) => getMediaReferenceFacts(connection, ids) };
}
