import type { NextRequest } from "next/server";

import { apiSuccess, handleApiRoute } from "@/server/http";
import { getOrderNotificationDeliveryHealth } from "@/server/modules/orders";

import { orderRequestContext } from "../../route-helper";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async () => {
    const { connection } = await orderRequestContext(request, "orders:read");
    return apiSuccess(await getOrderNotificationDeliveryHealth(connection), {
      headers: { "Cache-Control": "private, no-store" },
    });
  });
}
