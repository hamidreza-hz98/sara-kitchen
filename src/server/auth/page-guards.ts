import "server-only";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import type { AdminPermission } from "@/constants/admin-access";
import { connectToDatabase } from "@/server/database";
import {
  adminCookieName,
  AuthorizationGuardError,
  customerCookieName,
  requireAdminActor,
  requireCustomerActor,
  requireDashboardActor,
} from "@/server/modules/auth";

export async function requireAdminPage(permission: AdminPermission = "dashboard:view") {
  const token = (await cookies()).get(adminCookieName())?.value;
  if (!token) redirect("/authentication");
  try {
    return await requireAdminActor(await connectToDatabase(), token, permission);
  } catch (error) {
    if (error instanceof AuthorizationGuardError) {
      if (error.reason === "unauthenticated") redirect("/authentication");
      notFound();
    }
    throw error;
  }
}

export async function requireDashboardPage(segments: readonly string[]) {
  const token = (await cookies()).get(adminCookieName())?.value;
  if (!token) redirect("/authentication");
  try {
    return await requireDashboardActor(await connectToDatabase(), token, segments);
  } catch (error) {
    if (error instanceof AuthorizationGuardError) {
      if (error.reason === "unauthenticated") redirect("/authentication");
      notFound();
    }
    throw error;
  }
}

export async function requireCustomerPage() {
  const token = (await cookies()).get(customerCookieName())?.value;
  if (!token) redirect("/login");
  try {
    return await requireCustomerActor(await connectToDatabase(), token);
  } catch (error) {
    if (error instanceof AuthorizationGuardError) redirect("/login");
    throw error;
  }
}
