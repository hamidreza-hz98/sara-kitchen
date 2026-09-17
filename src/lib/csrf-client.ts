export type CsrfPrincipal = "admin" | "customer";

/** Fetch on demand so login rotation cannot leave a stale CSRF token in memory. */
export async function fetchCsrfToken(principal: CsrfPrincipal): Promise<string> {
  const response = await fetch(`/api/auth/csrf?principal=${principal}`, {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error("CSRF token unavailable.");
  const body = (await response.json()) as { data?: { csrfToken?: unknown } };
  if (typeof body.data?.csrfToken !== "string") throw new Error("Invalid CSRF token response.");
  return body.data.csrfToken;
}

export async function csrfJsonHeaders(principal: CsrfPrincipal): Promise<HeadersInit> {
  return { "content-type": "application/json", "x-csrf-token": await fetchCsrfToken(principal) };
}
