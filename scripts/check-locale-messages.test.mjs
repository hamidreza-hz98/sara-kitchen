import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { LOCALES, MESSAGE_NAMESPACES, validateLocaleCatalogs } from "./lib/locale-catalogs.mjs";

async function writeCatalog(root, mutate = () => undefined) {
  for (const locale of LOCALES) {
    const localeRoot = path.join(root, locale);
    await mkdir(localeRoot, { recursive: true });

    for (const namespace of MESSAGE_NAMESPACES) {
      const message = { label: `${locale} ${namespace}`, greeting: "Hello {name}" };
      mutate({ locale, namespace, message });
      await writeFile(path.join(localeRoot, `${namespace}.json`), JSON.stringify(message));
    }
  }
}

test("locale validation accepts complete catalogs", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sara-locales-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  await writeCatalog(root);

  assert.deepEqual(await validateLocaleCatalogs(root), []);
});

test("locale validation rejects missing, empty, extra, and incompatible messages", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sara-locales-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  await writeCatalog(root, ({ locale, namespace, message }) => {
    if (locale === "fa" && namespace === "errors") {
      delete message.label;
      message.greeting = "";
      message.extra = "unexpected";
    }

    if (locale === "pt-PT" && namespace === "validation") {
      message.greeting = "Olá";
    }
  });

  const errors = await validateLocaleCatalogs(root);

  assert(errors.includes("fa: missing message errors.label"));
  assert(errors.includes("fa: unexpected message errors.extra"));
  assert(errors.includes("errors.greeting must not be empty"));
  assert(errors.includes("pt-PT: placeholders differ for validation.greeting"));
});
