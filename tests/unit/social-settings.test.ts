import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  parseSocialSettings,
  projectPublicSocialSettings,
  type SocialSettingsPayload,
} from "@/server/modules/settings";

function payload(): SocialSettingsPayload {
  return {
    data: {
      links: [
        {
          id: "instagram-main",
          platform: "instagram",
          destination: { type: "handle", handle: "sara_kitchenpt" },
          iconKey: "instagram",
          active: false,
          order: 4,
        },
        {
          id: "telegram-channel",
          platform: "telegram",
          destination: { type: "handle", handle: "@sara_kitchenpt" },
          iconKey: "telegram",
          active: true,
          order: 2,
        },
        {
          id: "whatsapp-orders",
          platform: "whatsapp",
          destination: { type: "handle", handle: "+351939086377" },
          iconKey: "whatsapp",
          active: true,
          order: 1,
        },
        {
          id: "linkedin-profile",
          platform: "linkedin",
          destination: { type: "url", url: "https://www.linkedin.com/in/sara-kazemi" },
          iconKey: "linkedin",
          active: true,
          order: 3,
        },
      ],
    },
    translations: [
      {
        locale: "en",
        value: {
          labels: [
            { id: "instagram-main", label: "Sara Kitchen on Instagram" },
            { id: "telegram-channel", label: "Sara Kitchen on Telegram" },
            { id: "whatsapp-orders", label: "Order through WhatsApp" },
            { id: "linkedin-profile", label: "Sara Kitchen on LinkedIn" },
          ],
        },
      },
      {
        locale: "pt-PT",
        value: {
          labels: [{ id: "whatsapp-orders", label: "Encomendar pelo WhatsApp" }],
        },
      },
    ],
  };
}

describe("social-media settings", () => {
  it("accepts allow-listed platforms, icons, URLs, handles, active state, and order", () => {
    const parsed = parseSocialSettings(payload());
    expect(parsed.data.links.map(({ platform }) => platform)).toEqual([
      "instagram",
      "telegram",
      "whatsapp",
      "linkedin",
    ]);
  });

  it("rejects unsafe protocols and platform-host mismatches", () => {
    const javascript = payload();
    javascript.data.links[3]!.destination = {
      type: "url",
      url: "javascript:alert(document.domain)",
    };
    expect(() => parseSocialSettings(javascript)).toThrow(/HTTPS/u);

    const mismatched = payload();
    mismatched.data.links[3]!.destination = {
      type: "url",
      url: "https://instagram.com/sara-kitchen",
    };
    expect(() => parseSocialSettings(mismatched)).toThrow(/allow-listed host/u);
  });

  it("rejects credentials and sensitive URL query parameters", () => {
    const credentials = payload();
    credentials.data.links[3]!.destination = {
      type: "url",
      url: "https://user:password@www.linkedin.com/in/sara-kazemi",
    };
    expect(() => parseSocialSettings(credentials)).toThrow();

    const token = payload();
    token.data.links[3]!.destination = {
      type: "url",
      url: "https://www.linkedin.com/in/sara-kazemi?access_token=secret",
    };
    expect(() => parseSocialSettings(token)).toThrow();
  });

  it("validates handles by platform", () => {
    const invalidWhatsApp = payload();
    invalidWhatsApp.data.links[2]!.destination = { type: "handle", handle: "00351 939 086 377" };
    expect(() => parseSocialSettings(invalidWhatsApp)).toThrow(/E.164/u);

    const invalidTelegram = payload();
    invalidTelegram.data.links[1]!.destination = { type: "handle", handle: "<script>" };
    expect(() => parseSocialSettings(invalidTelegram)).toThrow(/Invalid handle/u);
  });

  it("rejects arbitrary icon markup, platforms, unknown fields, duplicate IDs, and order", () => {
    const markup = payload() as unknown as Record<string, unknown>;
    const first = (markup.data as { links: Record<string, unknown>[] }).links[0]!;
    first.iconKey = "<svg onload=alert(1)>";
    first.renderHtml = "<script>alert(1)</script>";
    expect(() => parseSocialSettings(markup)).toThrow();

    const duplicates = payload();
    duplicates.data.links[1]!.id = duplicates.data.links[0]!.id;
    duplicates.data.links[1]!.order = duplicates.data.links[0]!.order;
    expect(() => parseSocialSettings(duplicates)).toThrow(/unique/u);
  });

  it("requires canonical English labels for every link", () => {
    const invalid = payload();
    invalid.translations[0]!.value.labels.pop();
    expect(() => parseSocialSettings(invalid)).toThrow(/label every configured/u);
  });

  it("renders only active links in configured order with safe anchor attributes", () => {
    const projected = projectPublicSocialSettings(parseSocialSettings(payload()), "pt-PT");
    expect(projected.locale).toEqual({
      requested: "pt-PT",
      resolved: "pt-PT",
      isFallback: false,
    });
    expect(projected.links).toEqual([
      {
        platform: "whatsapp",
        label: "Encomendar pelo WhatsApp",
        href: "https://wa.me/351939086377",
        iconKey: "whatsapp",
        order: 1,
        target: "_blank",
        rel: "noopener noreferrer",
      },
      {
        platform: "telegram",
        label: "Sara Kitchen on Telegram",
        href: "https://t.me/sara_kitchenpt",
        iconKey: "telegram",
        order: 2,
        target: "_blank",
        rel: "noopener noreferrer",
      },
      {
        platform: "linkedin",
        label: "Sara Kitchen on LinkedIn",
        href: "https://www.linkedin.com/in/sara-kazemi",
        iconKey: "linkedin",
        order: 3,
        target: "_blank",
        rel: "noopener noreferrer",
      },
    ]);
  });

  it("falls back to canonical English when the requested locale is absent", () => {
    const projected = projectPublicSocialSettings(parseSocialSettings(payload()), "fa");
    expect(projected.locale).toEqual({ requested: "fa", resolved: "en", isFallback: true });
    expect(projected.links[0]?.label).toBe("Order through WhatsApp");
  });
});
