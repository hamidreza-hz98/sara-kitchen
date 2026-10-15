import type { NextRequest } from "next/server";

import { apiSuccess, handleApiRoute } from "@/server/http";
import { listCustomerOrderNotifications } from "@/server/modules/orders";

import { customerSelfRequestContext } from "../../customers/route-helper";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async () => {
    const { connection, actor } = await customerSelfRequestContext(request);
    const notifications = await listCustomerOrderNotifications(connection, actor.id);
    return apiSuccess(
      { items: notifications },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  });
}
