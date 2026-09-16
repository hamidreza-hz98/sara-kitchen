import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { connectToDatabase } from "@/server/database";
import { customerCookieName, resolveCustomerActor } from "@/server/modules/auth";

export const dynamic = "force-dynamic";

export default async function ProtectedProfileLayout({ children }: { children: ReactNode }) {
  const token = (await cookies()).get(customerCookieName())?.value;
  if (!token) redirect("/login");
  const customer = await resolveCustomerActor(await connectToDatabase(), token);
  if (!customer) redirect("/login");
  return children;
}
