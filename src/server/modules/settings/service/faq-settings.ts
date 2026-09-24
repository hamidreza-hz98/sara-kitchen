import type { SupportedLocale } from "@/constants";
import { buildLocaleResolutionOrder } from "@/locales/translation-selection";

import {
  parseFaqSettings,
  type FaqSettingsPayload,
  type FaqSettingsTranslationValue,
} from "../validation/faq-settings";

type LocalizedFaqInput = Readonly<{
  answer: string;
  locale: SupportedLocale;
  question: string;
}>;

export type FaqSettingsOperation =
  | Readonly<{
      type: "add";
      id: string;
      active?: boolean;
      translations: readonly LocalizedFaqInput[];
    }>
  | Readonly<{
      type: "edit";
      id: string;
      active?: boolean;
      translations?: readonly LocalizedFaqInput[];
    }>
  | Readonly<{ type: "remove"; id: string }>
  | Readonly<{ type: "reorder"; ids: readonly string[] }>;

export class FaqSettingsOperationError extends Error {
  readonly code: "already_exists" | "invalid_order" | "not_found";

  constructor(code: FaqSettingsOperationError["code"]) {
    super(`faq_operation_${code}`);
    this.name = "FaqSettingsOperationError";
    this.code = code;
  }
}

function findEntry(
  value: FaqSettingsTranslationValue,
  id: string,
): FaqSettingsTranslationValue["entries"][number] | undefined {
  return value.entries.find((entry) => entry.id === id);
}

/** Applies one immutable dashboard mutation and revalidates the complete settings invariant. */
export function applyFaqSettingsOperation(
  current: FaqSettingsPayload,
  operation: FaqSettingsOperation,
): FaqSettingsPayload {
  const next = structuredClone(current);
  const configured =
    operation.type === "reorder"
      ? undefined
      : next.data.entries.find(({ id }) => id === operation.id);

  if (operation.type === "add") {
    if (configured) throw new FaqSettingsOperationError("already_exists");
    next.data.entries.push({
      id: operation.id,
      active: operation.active ?? true,
      order:
        next.data.entries.length === 0
          ? 0
          : Math.max(...next.data.entries.map(({ order }) => order)) + 1,
    });
    for (const translation of operation.translations) {
      const target = next.translations.find(({ locale }) => locale === translation.locale);
      if (target) {
        target.value.entries.push({
          id: operation.id,
          question: translation.question,
          answer: translation.answer,
        });
      } else {
        next.translations.push({
          locale: translation.locale,
          value: {
            title: translation.locale === "en" ? "Frequently asked questions" : "FAQ",
            description: "",
            entries: [
              { id: operation.id, question: translation.question, answer: translation.answer },
            ],
          },
        });
      }
    }
  } else if (operation.type === "edit") {
    if (!configured) throw new FaqSettingsOperationError("not_found");
    if (operation.active !== undefined) configured.active = operation.active;
    for (const translation of operation.translations ?? []) {
      const target = next.translations.find(({ locale }) => locale === translation.locale);
      const entry = target ? findEntry(target.value, operation.id) : undefined;
      if (entry) {
        entry.question = translation.question;
        entry.answer = translation.answer;
      } else if (target) {
        target.value.entries.push({
          id: operation.id,
          question: translation.question,
          answer: translation.answer,
        });
      } else {
        next.translations.push({
          locale: translation.locale,
          value: {
            title: translation.locale === "en" ? "Frequently asked questions" : "FAQ",
            description: "",
            entries: [
              { id: operation.id, question: translation.question, answer: translation.answer },
            ],
          },
        });
      }
    }
  } else if (operation.type === "remove") {
    if (!configured) throw new FaqSettingsOperationError("not_found");
    next.data.entries = next.data.entries
      .filter(({ id }) => id !== operation.id)
      .toSorted((left, right) => left.order - right.order)
      .map((entry, order) => ({ ...entry, order }));
    next.translations.forEach((translation) => {
      translation.value.entries = translation.value.entries.filter(({ id }) => id !== operation.id);
    });
  } else {
    const currentIds = new Set(next.data.entries.map(({ id }) => id));
    if (
      operation.ids.length !== currentIds.size ||
      new Set(operation.ids).size !== operation.ids.length ||
      operation.ids.some((id) => !currentIds.has(id))
    ) {
      throw new FaqSettingsOperationError("invalid_order");
    }
    const orders = new Map(operation.ids.map((id, order) => [id, order]));
    next.data.entries = next.data.entries.map((entry) => ({
      ...entry,
      order: orders.get(entry.id)!,
    }));
  }

  return parseFaqSettings(next);
}

export type PublicFaqEntry = Readonly<{
  answer: string;
  id: string;
  isFallback: boolean;
  order: number;
  question: string;
  resolvedLocale: SupportedLocale;
}>;

export type PublicFaqSettings = Readonly<{
  entries: readonly PublicFaqEntry[];
  requestedLocale: SupportedLocale;
}>;

/** Resolves each item independently so a partially translated locale remains useful. */
export function projectPublicFaqSettings(
  payload: FaqSettingsPayload,
  requestedLocale: SupportedLocale,
  fallbackLocale?: SupportedLocale | null,
): PublicFaqSettings {
  const localeOrder = buildLocaleResolutionOrder(requestedLocale, {
    ...(fallbackLocale !== undefined ? { fallbackLocale } : {}),
  });
  const entries = payload.data.entries
    .filter(({ active }) => active)
    .toSorted((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    .map((configured): PublicFaqEntry => {
      for (const candidate of localeOrder) {
        const translation = payload.translations.find(({ locale }) => locale === candidate.locale);
        const entry = translation ? findEntry(translation.value, configured.id) : undefined;
        if (entry) {
          return {
            id: configured.id,
            order: configured.order,
            question: entry.question,
            answer: entry.answer,
            resolvedLocale: candidate.locale,
            isFallback: candidate.locale !== requestedLocale,
          };
        }
      }
      throw new Error(`faq_translation_unavailable:${configured.id}`);
    });
  return { requestedLocale, entries };
}

/** Produces the exact plain-text input consumed by the established FAQPage SEO generator. */
export function toFaqStructuredDataInputs(settings: PublicFaqSettings): Readonly<{
  faqs: readonly Readonly<{ answer: string; question: string }>[];
}> {
  return {
    faqs: settings.entries.map(({ question, answer }) => ({ question, answer })),
  };
}
