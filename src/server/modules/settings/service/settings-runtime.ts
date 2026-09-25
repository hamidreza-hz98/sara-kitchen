import "server-only";

import type { Connection } from "mongoose";
import { revalidateTag } from "next/cache";

import { createSettingsSectionRepository } from "../repository/settings-section";
import { createSettingsAuditSink } from "./settings-audit";
import { createNextSettingsPublicCache } from "./settings-cache";
import { createSettingsServices } from "./settings-service";

/** Production composition root for Route Handlers and server-rendered settings consumers. */
export function createSettingsRuntime(
  connection: Connection,
  context: Readonly<{ requestId: string; userAgent?: string | null }>,
) {
  return createSettingsServices({
    repository: createSettingsSectionRepository(connection),
    cache: createNextSettingsPublicCache(),
    audit: createSettingsAuditSink(connection, context),
    invalidate: (tag) => revalidateTag(tag, { expire: 0 }),
  });
}
