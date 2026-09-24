import type { SupportedLocale } from "@/constants";
import { resolveTranslation } from "@/locales/translation-selection";

import type {
  ContactSettingsPayload,
  ContactSettingsTranslation,
} from "../validation/contact-settings";

export type PublicContactSettings = Readonly<{
  locale: Readonly<{
    requested: SupportedLocale;
    resolved: SupportedLocale;
    isFallback: boolean;
  }>;
  phones: readonly Readonly<{
    kind: "mobile" | "landline";
    label: string;
    number: string;
    primary: boolean;
  }>[];
  whatsapp: Readonly<{ number: string; prefilledMessage: string }> | null;
  email: string;
  address: Readonly<{
    line1: string;
    line2: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
    countryCode: string;
  }>;
  location: Readonly<{ latitude: number; longitude: number }>;
  serviceArea: Readonly<{
    mode: "city" | "radius";
    radiusKm: number | null;
    name: string;
    description: string;
  }>;
  businessHours: ContactSettingsPayload["data"]["businessHours"];
  businessHoursNote: string;
  timeZone: ContactSettingsPayload["data"]["timeZone"];
  map: (NonNullable<ContactSettingsPayload["data"]["map"]> & Readonly<{ label: string }>) | null;
}>;

/** Allow-listed public projection. Provider credentials are environment-only and never accepted or returned. */
export function projectPublicContactSettings(
  payload: ContactSettingsPayload,
  requestedLocale: SupportedLocale,
  fallbackLocale?: SupportedLocale | null,
): PublicContactSettings {
  const translations: ContactSettingsTranslation[] = payload.translations;
  const selection = resolveTranslation(translations, requestedLocale, {
    ...(fallbackLocale !== undefined ? { fallbackLocale } : {}),
  });
  if (!selection) throw new Error("contact_translation_unavailable");
  const localized = selection.value.value;
  const labels = new Map(localized.phoneLabels.map(({ id, label }) => [id, label]));
  const canonical = payload.translations.find(({ locale }) => locale === "en")?.value;

  return {
    locale: {
      requested: requestedLocale,
      resolved: selection.resolvedLocale,
      isFallback: selection.isFallback,
    },
    phones: payload.data.phones
      .filter((phone) => phone.public)
      .map((phone) => ({
        kind: phone.kind,
        label:
          labels.get(phone.id) ??
          canonical?.phoneLabels.find(({ id }) => id === phone.id)?.label ??
          "Contact",
        number: phone.number,
        primary: phone.primary,
      })),
    whatsapp: payload.data.whatsapp.enabled
      ? {
          number: payload.data.whatsapp.number,
          prefilledMessage: localized.whatsappPrefilledMessage,
        }
      : null,
    email: payload.data.email,
    address: {
      ...localized.address,
      postalCode: payload.data.address.postalCode,
      countryCode: payload.data.address.countryCode,
    },
    location: { ...payload.data.location },
    serviceArea: { ...payload.data.serviceArea, ...localized.serviceArea },
    businessHours: payload.data.businessHours.map(({ day, periods }) => ({
      day,
      periods: periods.map((period) => ({ ...period })),
    })),
    businessHoursNote: localized.businessHoursNote,
    timeZone: payload.data.timeZone,
    map: payload.data.map ? { ...payload.data.map, label: localized.mapLabel } : null,
  };
}
