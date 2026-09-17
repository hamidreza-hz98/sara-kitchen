import "server-only";

import { getServerEnvironment } from "@/server/environment";

export type ResetSmsSender = (mobile: string, link: string, locale: string) => Promise<void>;

const messages: Record<string, (link: string) => string> = {
  en: (link) =>
    `Sara Kitchen password reset: ${link} Expires in 15 minutes. Ignore if you did not request it.`,
  "pt-PT": (link) =>
    `Sara Kitchen: redefina a palavra-passe em ${link} Expira em 15 minutos. Ignore se não pediu.`,
  fa: (link) =>
    `آشپزخانه سارا: بازنشانی گذرواژه ${link} این پیوند تا ۱۵ دقیقه معتبر است. اگر درخواست نداده‌اید، نادیده بگیرید.`,
};

/** Configured only after real provider credentials are supplied. */
export function resetSmsEnabled(): boolean {
  return getServerEnvironment().RESET_SMS_ENABLED;
}

export const sendResetSms: ResetSmsSender = async (mobile, link, locale) => {
  const config = getServerEnvironment();
  if (
    !config.RESET_SMS_ENABLED ||
    !config.TWILIO_RESET_ACCOUNT_SID ||
    !config.TWILIO_RESET_AUTH_TOKEN ||
    !config.TWILIO_RESET_FROM_NUMBER
  ) {
    throw new Error("Password reset SMS provider is not configured.");
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.TWILIO_RESET_ACCOUNT_SID}/Messages.json`;
  const body = new URLSearchParams({
    To: mobile,
    From: config.TWILIO_RESET_FROM_NUMBER,
    Body: (messages[locale] ?? messages.en)!(link),
  });
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${config.TWILIO_RESET_ACCOUNT_SID}:${config.TWILIO_RESET_AUTH_TOKEN}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Password reset SMS delivery was rejected.");
};
