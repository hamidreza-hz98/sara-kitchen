import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  CONTACT_WEEKDAYS,
  parseContactSettings,
  projectPublicContactSettings,
  type ContactSettingsPayload,
} from "@/server/modules/settings";

function payload(): ContactSettingsPayload {
  return {
    data: {
      phones: [
        {
          id: "main-mobile",
          kind: "mobile",
          number: "+351939086377",
          primary: true,
          public: true,
        },
        {
          id: "operations-only",
          kind: "landline",
          number: "+351220000001",
          primary: false,
          public: false,
        },
      ],
      whatsapp: { enabled: true, number: "+351939086377" },
      email: "hello@sarakitchen.pt",
      address: { postalCode: "4000-008", countryCode: "PT" },
      location: { latitude: 41.1579, longitude: -8.6291 },
      serviceArea: { mode: "city", radiusKm: null },
      businessHours: CONTACT_WEEKDAYS.map((day) => ({
        day,
        periods: day === "sunday" ? [] : [{ opensAt: "09:00", closesAt: "18:00" }],
      })),
      timeZone: "Europe/Lisbon",
      map: {
        provider: "leaflet",
        zoom: 14,
        embedUrl: null,
        directionsUrl: "https://www.google.com/maps/dir/?api=1&destination=41.1579,-8.6291",
      },
    },
    translations: [
      {
        locale: "en",
        value: {
          phoneLabels: [
            { id: "main-mobile", label: "Mobile" },
            { id: "operations-only", label: "Operations" },
          ],
          address: {
            line1: "Sara Kitchen",
            line2: "",
            city: "Porto",
            region: "Porto",
            country: "Portugal",
          },
          serviceArea: {
            name: "Porto city",
            description: "Delivery throughout Porto city.",
          },
          businessHoursNote: "Orders require 24 hours notice.",
          whatsappPrefilledMessage: "Hello Sara Kitchen",
          mapLabel: "Sara Kitchen location",
        },
      },
      {
        locale: "pt-PT",
        value: {
          phoneLabels: [{ id: "main-mobile", label: "Telemóvel" }],
          address: {
            line1: "Sara Kitchen",
            line2: "",
            city: "Porto",
            region: "Porto",
            country: "Portugal",
          },
          serviceArea: {
            name: "Cidade do Porto",
            description: "Entrega em toda a cidade do Porto.",
          },
          businessHoursNote: "Encomende com 24 horas de antecedência.",
          whatsappPrefilledMessage: "Olá Sara Kitchen",
          mapLabel: "Localização da Sara Kitchen",
        },
      },
    ],
  };
}

describe("contact-information settings", () => {
  it("accepts normalized contact, Porto location, service area, and weekly hours", () => {
    const input = payload();
    input.data.email = "  HELLO@SaraKitchen.PT ";
    const parsed = parseContactSettings(input);
    expect(parsed.data.email).toBe("hello@sarakitchen.pt");
    expect(parsed.data.businessHours.map(({ day }) => day)).toEqual(CONTACT_WEEKDAYS);
    expect(parsed.data.location).toEqual({ latitude: 41.1579, longitude: -8.6291 });
  });

  it("rejects malformed phones, email, and coordinates", () => {
    const invalid = payload() as unknown as Record<string, unknown>;
    const data = invalid.data as Record<string, unknown>;
    data.phones = [
      {
        id: "main-mobile",
        kind: "mobile",
        number: "00351 939 086 377",
        primary: true,
        public: true,
      },
    ];
    data.email = "not-an-email";
    data.location = { latitude: 91, longitude: -181 };
    expect(() => parseContactSettings(invalid)).toThrow();
  });

  it("requires one primary phone and every weekday exactly once", () => {
    const invalid = payload();
    invalid.data.phones = invalid.data.phones.map((phone) => ({ ...phone, primary: false }));
    invalid.data.businessHours[6] = { day: "monday", periods: [] };
    expect(() => parseContactSettings(invalid)).toThrow(/primary/u);
    expect(() => parseContactSettings(invalid)).toThrow(/weekday/u);
  });

  it("rejects overlapping periods and inconsistent service-area modes", () => {
    const invalid = payload();
    invalid.data.businessHours[0]!.periods = [
      { opensAt: "09:00", closesAt: "13:00" },
      { opensAt: "12:30", closesAt: "18:00" },
    ];
    invalid.data.serviceArea = { mode: "city", radiusKm: 20 };
    expect(() => parseContactSettings(invalid)).toThrow();
  });

  it("allows only provider-compatible, credential-free map configuration", () => {
    const google = payload();
    google.data.map = {
      provider: "google_maps_embed",
      zoom: 14,
      embedUrl: "https://www.google.com/maps/embed?pb=public-map-payload",
      directionsUrl: null,
    };
    expect(() => parseContactSettings(google)).not.toThrow();

    const withSecret = structuredClone(google) as unknown as Record<string, unknown>;
    (withSecret.data as { map: Record<string, unknown> }).map.apiKey = "must-not-be-stored";
    expect(() => parseContactSettings(withSecret)).toThrow();

    const querySecret = payload();
    querySecret.data.map = {
      provider: "leaflet",
      zoom: 14,
      embedUrl: null,
      directionsUrl: "https://maps.example.com/directions?apiKey=must-not-be-stored",
    };
    expect(() => parseContactSettings(querySecret)).toThrow(/credential-free/u);

    const wrongHost = payload();
    wrongHost.data.map = {
      provider: "google_maps_embed",
      zoom: 14,
      embedUrl: "https://maps.example.com/embed/location",
      directionsUrl: null,
    };
    expect(() => parseContactSettings(wrongHost)).toThrow(/Google Maps/u);
  });

  it("requires canonical labels to cover every configured phone", () => {
    const invalid = payload();
    invalid.translations[0]!.value.phoneLabels = [{ id: "main-mobile", label: "Mobile" }];
    expect(() => parseContactSettings(invalid)).toThrow(/label every configured phone/u);
  });

  it("creates a locale-aware allow-listed public projection", () => {
    const parsed = parseContactSettings(payload());
    const projected = projectPublicContactSettings(parsed, "pt-PT");
    expect(projected).toMatchObject({
      locale: { requested: "pt-PT", resolved: "pt-PT", isFallback: false },
      phones: [{ label: "Telemóvel", number: "+351939086377" }],
      email: "hello@sarakitchen.pt",
      address: { city: "Porto", postalCode: "4000-008", countryCode: "PT" },
      serviceArea: { mode: "city", name: "Cidade do Porto" },
      timeZone: "Europe/Lisbon",
      map: { label: "Localização da Sara Kitchen" },
    });
    expect(projected.phones).toHaveLength(1);
    expect(JSON.stringify(projected)).not.toContain("operations-only");
    expect(JSON.stringify(projected)).not.toMatch(/apiKey|secret|credential/iu);
  });

  it("falls back to canonical English and hides disabled WhatsApp", () => {
    const input = payload();
    input.data.whatsapp.enabled = false;
    const projected = projectPublicContactSettings(parseContactSettings(input), "fa");
    expect(projected.locale).toEqual({ requested: "fa", resolved: "en", isFallback: true });
    expect(projected.whatsapp).toBeNull();
    expect(projected.serviceArea.name).toBe("Porto city");
  });
});
