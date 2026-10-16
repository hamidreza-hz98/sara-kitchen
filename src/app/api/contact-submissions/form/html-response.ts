import "server-only";

import { getTranslations } from "next-intl/server";

import { isRtlLocale, type SupportedLocale } from "@/constants";

export type ContactFormFeedback = "form" | "sent" | "invalid" | "limited" | "error" | "forbidden";

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/gu,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ??
      character,
  );
}

/** Native form response requires no JavaScript and contains no submitted PII. */
export async function htmlResponse(
  locale: SupportedLocale,
  feedback: ContactFormFeedback,
): Promise<Response> {
  const t = await getTranslations({ locale, namespace: "storefront.contact" });
  if (feedback === "form") {
    const field = (name: string, label: string, type = "text", attributes = "") =>
      `<label style="display:grid;gap:.35rem;margin-block:1rem">${escapeHtml(label)}<input name="${name}" type="${type}" ${attributes} style="padding:.75rem;border:1px solid #978c96;border-radius:.5rem;font:inherit"></label>`;
    const form = `<h1>${escapeHtml(t("formTitle"))}</h1><p>${escapeHtml(t("formIntro"))}</p><form method="post" action="/api/contact-submissions/form">${field("fullName", t("name"), "text", 'required maxlength="100" autocomplete="name"')}${field("mobile", t("phone"), "tel", 'maxlength="30" autocomplete="tel"')}${field("email", t("email"), "email", 'maxlength="254" autocomplete="email"')}<p>${escapeHtml(t("contactMethodHint"))}</p><label style="display:grid;gap:.35rem;margin-block:1rem">${escapeHtml(t("message"))}<textarea name="message" required minlength="10" maxlength="4000" rows="6" style="padding:.75rem;border:1px solid #978c96;border-radius:.5rem;font:inherit"></textarea></label><div style="position:absolute;left:-10000px" aria-hidden="true"><label>Company<input name="company" tabindex="-1" autocomplete="off"></label></div><label style="display:flex;gap:.5rem;align-items:start"><input name="privacyAccepted" type="checkbox" required>${escapeHtml(t("consent"))}</label><p>${escapeHtml(t("privacyNotice"))}</p><button type="submit" style="padding:.8rem 1.25rem;border:0;border-radius:.5rem;background:#ff6161;color:#2c2c47;font:inherit;font-weight:700">${escapeHtml(t("send"))}</button></form>`;
    return pageResponse(locale, form, 200);
  }
  const message = escapeHtml(
    t(feedback === "forbidden" ? "feedback.error" : `feedback.${feedback}`),
  );
  const back = escapeHtml(t("back"));
  const status =
    feedback === "sent"
      ? 200
      : feedback === "invalid"
        ? 400
        : feedback === "limited"
          ? 429
          : feedback === "forbidden"
            ? 403
            : 503;
  return pageResponse(
    locale,
    `<h1>${message}</h1><a href="/api/contact-submissions/form" style="color:#c93643">${back}</a>`,
    status,
  );
}

function pageResponse(locale: SupportedLocale, content: string, status: number): Response {
  const html = `<!doctype html><html lang="${locale}" dir="${isRtlLocale(locale) ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Sara Kitchen</title></head><body style="margin:0;padding:2rem;min-height:100vh;display:grid;place-items:center;background:#f8f5f5;color:#2c2c47;font-family:system-ui,sans-serif"><main style="width:100%;max-width:34rem;padding:2rem;border-radius:1.25rem;background:#fff">${content}</main></body></html>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
