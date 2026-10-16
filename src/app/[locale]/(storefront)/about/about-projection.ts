import type { SupportedLocale } from "@/constants";
import {
  sanitizeRichTextDocument,
  type RichTextDocument,
  type RichTextNode,
} from "@/lib/rich-text";
import { resolveTranslation } from "@/locales/translation-selection";
import type { AboutSettingsPayload } from "@/server/modules/settings";

import type { AboutContent, AboutImage } from "./about-content";

type ImageResolver = (id: string, alt: string) => Promise<AboutImage | null>;
type EmbedResolver = (
  id: string,
  kind: "image" | "video",
) => Promise<{ kind: "image" | "video"; url: string } | null>;

function embeddedUses(
  document: RichTextDocument,
): readonly { id: string; kind: "image" | "video" }[] {
  const uses: { id: string; kind: "image" | "video" }[] = [];
  const visit = (nodes: readonly RichTextNode[] | undefined) => {
    nodes?.forEach((node) => {
      if (node.type === "media") uses.push({ id: node.attrs.mediaId, kind: node.attrs.kind });
      else if ("content" in node) visit(node.content);
    });
  };
  visit(document.content);
  return uses;
}

/** Project only enabled, localized public content; partial translations fall back per item. */
export async function projectAboutContent(
  settings: AboutSettingsPayload,
  locale: SupportedLocale,
  image: ImageResolver,
  resolveEmbed?: EmbedResolver,
): Promise<AboutContent> {
  const localized = resolveTranslation(settings.translations, locale)?.value;
  const canonical = settings.translations.find((entry) => entry.locale === "en")?.value;
  if (!canonical) throw new Error("Published About settings require canonical English content.");
  const selected = localized?.value ?? canonical;
  const copyFor = <T extends { id: string }>(
    key: "teamMembers" | "values" | "storySections" | "callsToAction",
    id: string,
  ): T | undefined =>
    (selected[key].find((entry) => entry.id === id) ??
      canonical[key].find((entry) => entry.id === id)) as T | undefined;
  const ordered = <T extends { enabled: boolean; order: number }>(items: readonly T[]) =>
    items.filter((item) => item.enabled).toSorted((left, right) => left.order - right.order);
  const [hero, kitchen, values, sections, team, actions] = await Promise.all([
    settings.data.heroMediaId
      ? image(settings.data.heroMediaId, selected.heroMediaAlt || canonical.heroMediaAlt)
      : Promise.resolve(null),
    Promise.all(
      settings.data.kitchenMediaIds.map(async (id) => {
        const alt =
          selected.kitchenMedia.find((entry) => entry.mediaId === id)?.alt ??
          canonical.kitchenMedia.find((entry) => entry.mediaId === id)?.alt ??
          "";
        return image(id, alt);
      }),
    ),
    Promise.all(
      ordered(settings.data.values).map(async (item) => {
        const copy = copyFor<(typeof canonical.values)[number]>("values", item.id);
        if (!copy) return null;
        return {
          id: item.id,
          title: copy.title,
          description: copy.description,
          icon: item.iconMediaId ? await image(item.iconMediaId, "") : null,
        };
      }),
    ),
    Promise.all(
      ordered(settings.data.storySections).map(async (item) => {
        const copy = copyFor<(typeof canonical.storySections)[number]>("storySections", item.id);
        if (!copy) return null;
        return {
          id: item.id,
          title: copy.title,
          content: sanitizeRichTextDocument(copy.content.document),
          media: item.mediaId ? await image(item.mediaId, copy.mediaAlt) : null,
          placement: item.mediaPlacement,
        };
      }),
    ),
    Promise.all(
      ordered(settings.data.teamMembers).map(async (item) => {
        const copy = copyFor<(typeof canonical.teamMembers)[number]>("teamMembers", item.id);
        if (!copy) return null;
        return {
          id: item.id,
          name: copy.name,
          role: copy.role,
          bio: copy.bio,
          portrait: await image(item.portraitMediaId, copy.portraitAlt),
        };
      }),
    ),
    Promise.resolve(
      ordered(settings.data.callsToAction).flatMap((item) => {
        const copy = copyFor<(typeof canonical.callsToAction)[number]>("callsToAction", item.id);
        return copy
          ? [
              {
                id: item.id,
                label: copy.label,
                href: item.href,
                newTab: item.openInNewTab,
                variant: item.variant,
              },
            ]
          : [];
      }),
    ),
  ]);
  const compact = <T>(items: readonly (T | null)[]): T[] =>
    items.filter((item): item is T => item !== null);
  const story = sanitizeRichTextDocument(selected.content.document);
  const uses = [story, ...compact(sections).map((section) => section.content)]
    .flatMap(embeddedUses)
    .filter((use, index, all) => all.findIndex((item) => item.id === use.id) === index);
  const embeddedMedia = resolveEmbed
    ? Object.fromEntries(
        compact(
          await Promise.all(
            uses.map(async (use) => {
              const media = await resolveEmbed(use.id, use.kind);
              return media ? ([use.id, media] as const) : null;
            }),
          ),
        ),
      )
    : {};
  return {
    eyebrow: selected.eyebrow || canonical.eyebrow,
    title: selected.title,
    summary: selected.summary,
    story,
    hero,
    kitchen: compact(kitchen),
    values: compact(values),
    sections: compact(sections),
    team: compact(team),
    actions,
    embeddedMedia,
  };
}
