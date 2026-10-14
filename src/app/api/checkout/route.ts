import type { NextRequest } from "next/server";

import { ApiError, handleApiRoute } from "@/server/http";
import { isSameOriginMutation } from "@/server/modules/auth";

export const runtime = "nodejs";

/** Fail closed until SK-0154 adds atomic order/payment creation. */
export async function POST(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async () => {
    if (!isSameOriginMutation(request)) throw ApiError.authorization();
    throw ApiError.conflict({
      resource: "checkout",
      publicMessage: "Checkout is not available yet. Your cart has not been submitted or charged.",
    });
  });
}
