import type { NextRequest } from "next/server";

import { handleApiRoute } from "@/server/http";

import { mutateActorSessions, readActorSessions } from "../../sessions-helper";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, () => readActorSessions(request, "customer"));
}

export async function POST(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, () => mutateActorSessions(request, "customer"));
}
