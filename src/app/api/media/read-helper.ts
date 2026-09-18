import type { NextRequest } from "next/server";
import type { Connection } from "mongoose";

import { connectToDatabase } from "@/server/database";
import { ApiError } from "@/server/http";
import { AuthorizationGuardError, adminCookieName, requireAdminActor } from "@/server/modules/auth";
import { StorageError } from "@/server/modules/media";

export async function requireMediaReadConnection(request: NextRequest): Promise<Connection> {
  const token = request.cookies.get(adminCookieName())?.value;
  if (!token) throw ApiError.authentication();
  const connection = await connectToDatabase();
  try {
    await requireAdminActor(connection, token, "media:read");
  } catch (error) {
    if (error instanceof AuthorizationGuardError) {
      throw error.reason === "unauthenticated"
        ? ApiError.authentication()
        : ApiError.authorization();
    }
    throw error;
  }
  return connection;
}

export function rethrowMediaReadError(error: unknown): never {
  if (error instanceof StorageError && error.code === "unavailable") {
    throw ApiError.unavailable({ mongodb: "ready", objectStorage: "unavailable" });
  }
  throw error;
}
