import type { AbstractIntlMessages } from "next-intl";

import type { SupportedLocale } from "@/constants";

const messageLoaders = {
  en: async () => (await import("./messages/en.json")).default,
  "pt-PT": async () => (await import("./messages/pt-PT.json")).default,
  fa: async () => (await import("./messages/fa.json")).default,
} satisfies Record<SupportedLocale, () => Promise<AbstractIntlMessages>>;

export async function loadMessages(locale: SupportedLocale) {
  return messageLoaders[locale]();
}
