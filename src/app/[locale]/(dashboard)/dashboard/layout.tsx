import { redirect } from "next/navigation";

// SK-0050/0052 will replace this fail-closed gate with the database-backed,
// audience-bound admin session resolver. Never render admin UI from a client claim.
export default function ProtectedDashboardLayout() {
  redirect("/authentication");
}
