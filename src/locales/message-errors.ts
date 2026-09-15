type IntlMessageError = {
  code: string;
  message: string;
};

type MessageFallbackContext = {
  error: IntlMessageError;
  key: string;
  namespace?: string;
};

export function getMessagePath(namespace: string | undefined, key: string): string {
  return namespace ? `${namespace}.${key}` : key;
}

export function reportIntlError(error: IntlMessageError): void {
  if (process.env.NODE_ENV === "development") {
    console.warn(`[localization:${error.code}] ${error.message}`);
    return;
  }

  console.error(`[localization:${error.code}] ${error.message}`);
}

export function getIntlMessageFallback({ key, namespace }: MessageFallbackContext): string {
  const path = getMessagePath(namespace, key);

  return process.env.NODE_ENV === "development" ? `⟦missing: ${path}⟧` : path;
}
