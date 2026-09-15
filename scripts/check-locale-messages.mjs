import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateLocaleCatalogs } from "./lib/locale-catalogs.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const messagesRoot = path.join(repositoryRoot, "src", "locales", "messages");
const errors = await validateLocaleCatalogs(messagesRoot);

if (errors.length > 0) {
  console.error(`Locale catalog validation failed:\n- ${errors.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log("Locale catalogs are complete and structurally consistent.");
}
