import type { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";

import {
  apiSuccess,
  ApiError,
  handleApiRoute,
  parseJsonRequest,
  parseRouteParameters,
} from "@/server/http";
import {
  applyEntitySeoOverrides,
  createAutomaticSeoSynchronizer,
  entitySeoParametersSchema,
  entitySeoUpdateSchema,
  findEntitySeo,
  type EntitySeoUpdateInput,
} from "@/server/modules/seo";
import { createCategoryRepository } from "@/server/modules/categories";
import { createDishRepository } from "@/server/modules/dishes";
import { createBlogRepository } from "@/server/modules/blogs";
import { getApplicationSiteUrl } from "@/server/environment";
import { tagsForContentChange } from "@/server/cache";
import { recordAuditEvent } from "@/server/modules/logs";

import { staticSeoRequestContext } from "../../../static/route-helper";

export const runtime = "nodejs";
type Context = { params: Promise<{ entityKind: string; entityId: string }> };

async function synchronizeAutomaticFields(
  connection: Awaited<ReturnType<typeof staticSeoRequestContext>>["connection"],
  entityKind: "category" | "dish" | "blog",
  entityId: string,
) {
  const synchronizer = createAutomaticSeoSynchronizer(connection, {
    siteUrl: getApplicationSiteUrl(),
  });
  if (entityKind === "category") {
    const entity = await createCategoryRepository(connection).findById(entityId);
    if (entity) await synchronizer.category(entity);
  } else if (entityKind === "dish") {
    const entity = await createDishRepository(connection).findById(entityId);
    if (entity) await synchronizer.dish(entity);
  } else {
    const entity = await createBlogRepository(connection).findById(entityId);
    if (entity) await synchronizer.blog(entity);
  }
}

export async function GET(request: NextRequest, context: Context): Promise<Response> {
  return handleApiRoute(request, async () => {
    const { connection, validation } = await staticSeoRequestContext(request, "seo:read");
    const parameters = await parseRouteParameters(
      context.params,
      entitySeoParametersSchema,
      validation,
    );
    const value = await findEntitySeo(connection, parameters.entityKind, parameters.entityId);
    if (!value) throw ApiError.notFound("seo_page");
    return apiSuccess(value);
  });
}

export async function PATCH(request: NextRequest, context: Context): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await staticSeoRequestContext(
      request,
      "seo:update",
      true,
    );
    const [parameters, input] = await Promise.all([
      parseRouteParameters(context.params, entitySeoParametersSchema, validation),
      parseJsonRequest(request, entitySeoUpdateSchema, validation),
    ]);
    const saved = await applyEntitySeoOverrides(
      connection,
      parameters.entityKind,
      parameters.entityId,
      input as EntitySeoUpdateInput,
      actor.id,
    );
    if (!saved) throw ApiError.notFound("seo_page");
    await synchronizeAutomaticFields(connection, parameters.entityKind, parameters.entityId);
    const synchronized = await findEntitySeo(
      connection,
      parameters.entityKind,
      parameters.entityId,
    );
    for (const tag of tagsForContentChange({ area: "seo", ids: [saved.id] })) {
      revalidateTag(tag, { expire: 0 });
    }
    await recordAuditEvent(connection, {
      action: "crud.resource.update",
      actor: { kind: "admin", ref: actor.id, snapshot: { displayName: null, role: actor.role } },
      resource: {
        kind: "seo_page",
        ref: saved.id,
        snapshot: { code: parameters.entityKind, label: saved.path, status: "active" },
      },
      outcome: "success",
      requestId,
      context: { entityId: parameters.entityId, entityKind: parameters.entityKind },
      network: { policy: "omitted", ipHash: null, ipAddress: null },
      userAgent: request.headers.get("user-agent"),
    });
    return apiSuccess(synchronized ?? saved);
  });
}
