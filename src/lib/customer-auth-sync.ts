export const CUSTOMER_AUTH_SYNC_KEY = "sara-customer-auth-change";

/** Broadcast an invalidation signal only; never put credentials or identity in storage. */
export function broadcastCustomerAuthChange(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CUSTOMER_AUTH_SYNC_KEY, String(Date.now()));
  } catch {
    // Storage can be disabled; the current tab still receives the local event.
  }
  window.dispatchEvent(new Event(CUSTOMER_AUTH_SYNC_KEY));
}
