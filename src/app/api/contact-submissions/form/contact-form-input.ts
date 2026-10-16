import { CONTACT_NOTICE_VERSION, type SupportedLocale } from "@/constants";
import { contactSubmissionInputSchema } from "@/server/modules/contacts";

const MAX_FORM_BYTES = 16_384;

export class ContactFormInputError extends Error {}

/** Stream-bound native form decoder; never trust hidden locale/notice values. */
export async function readContactFormInput(request: Request, locale: SupportedLocale) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim();
  if (contentType !== "application/x-www-form-urlencoded") {
    throw new ContactFormInputError("unsupported_form_type");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new ContactFormInputError("missing_form_body");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    bytes += part.value.byteLength;
    if (bytes > MAX_FORM_BYTES) {
      await reader.cancel();
      throw new ContactFormInputError("form_too_large");
    }
    chunks.push(part.value);
  }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const fields = new URLSearchParams(new TextDecoder().decode(body));
  if (fields.get("company")) return { honeypot: true as const };
  const parsed = contactSubmissionInputSchema.safeParse({
    fullName: fields.get("fullName") ?? "",
    mobile: fields.get("mobile") ?? "",
    email: fields.get("email") ?? "",
    message: fields.get("message") ?? "",
    locale,
    pagePath: "/contact",
    privacyAccepted: fields.has("privacyAccepted"),
    privacyPolicyVersion: CONTACT_NOTICE_VERSION,
    marketingAccepted: false,
    company: "",
  });
  if (!parsed.success) throw new ContactFormInputError("invalid_form");
  return { honeypot: false as const, input: parsed.data };
}
