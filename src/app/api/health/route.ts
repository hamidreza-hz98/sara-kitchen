import { apiSuccess, handleApiRoute } from "@/server/http";

export function GET(request: Request): Promise<Response> {
  return handleApiRoute(request, () => apiSuccess({ status: "ok" as const }));
}
