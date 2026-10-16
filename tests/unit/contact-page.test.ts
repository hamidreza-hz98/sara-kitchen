import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  readContactFormInput,
  ContactFormInputError,
} from "@/app/api/contact-submissions/form/contact-form-input";
import {
  osmDirectionsUrl,
  osmEmbedUrl,
  whatsappHref,
} from "@/app/[locale]/(storefront)/contact/contact-links";
import { CONTACT_NOTICE_VERSION } from "@/constants";

function nativeRequest(values: Record<string, string>): Request {
  return new Request("https://example.test/api/contact-submissions/form", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(values),
  });
}

describe("Contact page helpers", () => {
  it("parses a native form using the cookie locale and current notice version", async () => {
    const result = await readContactFormInput(
      nativeRequest({
        fullName: "Sara Kazemi",
        mobile: "912 345 678",
        email: "",
        message: "Please tell me about your menu.",
        privacyAccepted: "on",
        locale: "fa",
        privacyPolicyVersion: "forged",
      }),
      "pt-PT",
    );
    expect(result.honeypot).toBe(false);
    if (result.honeypot) throw new Error("unexpected honeypot");
    expect(result.input.locale).toBe("pt-PT");
    expect(result.input.privacyPolicyVersion).toBe(CONTACT_NOTICE_VERSION);
    expect(result.input.mobile).toBe("+351912345678");
  });

  it("rejects missing contact method and missing consent", async () => {
    await expect(
      readContactFormInput(
        nativeRequest({
          fullName: "Sara Kazemi",
          mobile: "",
          email: "",
          message: "This is a proper message.",
        }),
        "en",
      ),
    ).rejects.toBeInstanceOf(ContactFormInputError);
    await expect(
      readContactFormInput(
        nativeRequest({
          fullName: "Sara Kazemi",
          email: "sara@example.test",
          message: "This is a proper message.",
        }),
        "en",
      ),
    ).rejects.toBeInstanceOf(ContactFormInputError);
  });

  it("accepts honeypot as a silent no-op", async () => {
    const result = await readContactFormInput(nativeRequest({ company: "bot-field" }), "en");
    expect(result.honeypot).toBe(true);
  });

  it("builds bounded provider URLs from validated coordinates and E.164 numbers", () => {
    const map = new URL(osmEmbedUrl({ latitude: 41.15, longitude: -8.61 }));
    expect(map.origin).toBe("https://www.openstreetmap.org");
    expect(map.searchParams.get("marker")).toBe("41.15,-8.61");
    expect(osmDirectionsUrl({ latitude: 41.15, longitude: -8.61 })).toContain("to=41.15%2C-8.61");
    expect(whatsappHref({ number: "+351912345678", prefilledMessage: "Hello Sara" })).toBe(
      "https://wa.me/351912345678?text=Hello+Sara",
    );
  });
});
