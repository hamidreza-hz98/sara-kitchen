import type { AbstractIntlMessages } from "next-intl";

import type { SupportedLocale } from "@/constants";

const messageLoaders = {
  en: async () => (await import("./messages/en")).default,
  "pt-PT": async () => (await import("./messages/pt-PT")).default,
  fa: async () => (await import("./messages/fa")).default,
} satisfies Record<SupportedLocale, () => Promise<AbstractIntlMessages>>;

function isMessageGroup(value: unknown): value is AbstractIntlMessages {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function mergeMessageCatalogs(
  fallback: AbstractIntlMessages,
  localized: AbstractIntlMessages,
): AbstractIntlMessages {
  return Object.fromEntries(
    Object.entries(fallback).map(([key, fallbackValue]) => {
      const localizedValue = localized[key];

      if (isMessageGroup(fallbackValue)) {
        return [
          key,
          mergeMessageCatalogs(fallbackValue, isMessageGroup(localizedValue) ? localizedValue : {}),
        ];
      }

      return [
        key,
        typeof localizedValue === "string" && localizedValue.trim().length > 0
          ? localizedValue
          : fallbackValue,
      ];
    }),
  );
}

export async function loadMessages(locale: SupportedLocale): Promise<AbstractIntlMessages> {
  const englishMessages = await messageLoaders.en();

  if (locale === "en") {
    return englishMessages;
  }

  return mergeMessageCatalogs(englishMessages, await messageLoaders[locale]());
}
