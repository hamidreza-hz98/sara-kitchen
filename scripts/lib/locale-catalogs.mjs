import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export const LOCALES = ["en", "pt-PT", "fa"];
export const MESSAGE_NAMESPACES = [
  "shared",
  "validation",
  "storefront",
  "profile",
  "dashboard",
  "entities",
  "errors",
];

function collectMessages(value, prefix, errors, messages) {
  if (typeof value === "string") {
    if (value.trim().length === 0) {
      errors.push(`${prefix} must not be empty`);
    }

    messages.set(prefix, value);
    return;
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    errors.push(`${prefix} must be a string or message object`);
    return;
  }

  const entries = Object.entries(value);

  if (entries.length === 0) {
    errors.push(`${prefix} must not be an empty object`);
  }

  for (const [key, child] of entries) {
    collectMessages(child, `${prefix}.${key}`, errors, messages);
  }
}

function placeholders(message) {
  return [...message.matchAll(/\{([A-Za-z][\w]*)\b[^}]*\}/g)].map((match) => match[1]).sort();
}

async function readLocale(messagesRoot, locale, errors) {
  const localeRoot = path.join(messagesRoot, locale);
  let entries;

  try {
    entries = await readdir(localeRoot, { withFileTypes: true });
  } catch {
    errors.push(`${locale}: locale directory is missing`);
    return new Map();
  }

  const jsonNamespaces = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name.slice(0, -5))
    .sort();
  const expectedNamespaces = [...MESSAGE_NAMESPACES].sort();

  for (const namespace of expectedNamespaces.filter((item) => !jsonNamespaces.includes(item))) {
    errors.push(`${locale}: missing namespace ${namespace}.json`);
  }

  for (const namespace of jsonNamespaces.filter((item) => !expectedNamespaces.includes(item))) {
    errors.push(`${locale}: unexpected namespace ${namespace}.json`);
  }

  const messages = new Map();

  for (const namespace of MESSAGE_NAMESPACES) {
    if (!jsonNamespaces.includes(namespace)) {
      continue;
    }

    const file = path.join(localeRoot, `${namespace}.json`);

    try {
      const parsed = JSON.parse(await readFile(file, "utf8"));
      collectMessages(parsed, namespace, errors, messages);
    } catch (error) {
      errors.push(`${locale}/${namespace}.json is invalid JSON: ${error.message}`);
    }
  }

  return messages;
}

export async function validateLocaleCatalogs(messagesRoot) {
  const errors = [];
  const catalogs = new Map();

  for (const locale of LOCALES) {
    catalogs.set(locale, await readLocale(messagesRoot, locale, errors));
  }

  const reference = catalogs.get("en") ?? new Map();

  for (const locale of LOCALES.filter((item) => item !== "en")) {
    const catalog = catalogs.get(locale) ?? new Map();

    for (const [key, englishMessage] of reference) {
      if (!catalog.has(key)) {
        errors.push(`${locale}: missing message ${key}`);
        continue;
      }

      const localizedMessage = catalog.get(key);

      if (
        localizedMessage !== undefined &&
        placeholders(localizedMessage).join(",") !== placeholders(englishMessage).join(",")
      ) {
        errors.push(`${locale}: placeholders differ for ${key}`);
      }
    }

    for (const key of catalog.keys()) {
      if (!reference.has(key)) {
        errors.push(`${locale}: unexpected message ${key}`);
      }
    }
  }

  return errors;
}
