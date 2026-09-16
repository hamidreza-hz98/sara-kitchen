import type { NextRequest } from "next/server";

import { connectToDatabase } from "@/server/database";
import { apiSuccess, handleApiRoute } from "@/server/http";
import { customerCookieName, resolveCustomerActor } from "@/server/modules/auth";

export const runtime = "nodejs";

type SessionStatus = { authenticated: boolean; displayName?: string };

export async function GET(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async () => {
    const token = request.cookies.get(customerCookieName())?.value;
    if (!token) return apiSuccess<SessionStatus>({ authenticated: false });
    const actor = await resolveCustomerActor(await connectToDatabase(), token);
    return actor
      ? apiSuccess<SessionStatus>({ authenticated: true, displayName: actor.displayName })
      : apiSuccess<SessionStatus>({ authenticated: false });
  });
}
