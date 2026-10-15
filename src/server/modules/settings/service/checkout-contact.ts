import "server-only";

import type { ClientSession, Connection } from "mongoose";

import type { SupportedLocale } from "@/constants";

import { getSettingsSectionModel } from "../model/settings-section";
import { parseContactSettings } from "../validation/contact-settings";
import { projectPublicContactSettings } from "./contact-public";

/** Bypass the storefront cache so checkout observes the current published delivery policy. */
export async function getCheckoutContactSettings(
  connection: Connection,
  locale: SupportedLocale,
  session: ClientSession,
) {
  const section = await getSettingsSectionModel(connection)
    .findOne({ key: "contact" })
    .session(session)
    .lean();
  if (!section?.published) return null;
  const payload = parseContactSettings({
    data: section.published.data,
    translations: section.published.translations,
  });
  return projectPublicContactSettings(payload, locale);
}
