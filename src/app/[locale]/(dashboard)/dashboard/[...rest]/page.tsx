import { notFound } from "next/navigation";

// The layout rejects unauthenticated requests first; no unimplemented deep-link
// route may accidentally render an admin page after session integration.
export default function DashboardDeepLinkPage() {
  notFound();
}
