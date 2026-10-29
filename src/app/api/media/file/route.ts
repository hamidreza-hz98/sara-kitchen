import type { NextRequest } from "next/server";

import {
  MongoDbStorageProvider,
  MONGODB_MEDIA_BUCKET,
  verifyMongoMediaSignature,
} from "@/server/modules/media/storage/mongodb-provider";

export async function GET(request: NextRequest): Promise<Response> {
  const key = request.nextUrl.searchParams.get("key") ?? "";
  const expiry = Number(request.nextUrl.searchParams.get("expires"));
  const token = request.nextUrl.searchParams.get("token") ?? "";
  if (!verifyMongoMediaSignature(key, expiry, token)) return new Response(null, { status: 403 });
  try {
    const result = await new MongoDbStorageProvider().read({ bucket: MONGODB_MEDIA_BUCKET, key });
    return new Response(result.body, {
      headers: {
        "Content-Type": result.contentType,
        "Content-Length": String(result.bytes),
        "Cache-Control": "private, max-age=60",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
