export const CUSTOMER_MOBILE_VERIFICATION_STORAGE_KEY = "sara.mobile-verification.v1";
export const CUSTOMER_MOBILE_VERIFICATION_STORAGE_EVENT = "sara-mobile-verification-change";

export type PendingCustomerMobileVerification = Readonly<{
  challengeToken: string;
  developmentCode?: string;
}>;

export function parsePendingCustomerMobileVerification(
  value: string | null,
): PendingCustomerMobileVerification | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    if (
      typeof record.challengeToken !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/u.test(record.challengeToken)
    )
      return null;
    return {
      challengeToken: record.challengeToken,
      ...(typeof record.developmentCode === "string" && /^\d{6}$/u.test(record.developmentCode)
        ? { developmentCode: record.developmentCode }
        : {}),
    };
  } catch {
    return null;
  }
}

export function subscribeToCustomerMobileVerification(onChange: () => void): () => void {
  const listener = () => onChange();
  window.addEventListener("storage", listener);
  window.addEventListener(CUSTOMER_MOBILE_VERIFICATION_STORAGE_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(CUSTOMER_MOBILE_VERIFICATION_STORAGE_EVENT, listener);
  };
}

export function getCustomerMobileVerificationSnapshot(): string | null {
  return window.sessionStorage.getItem(CUSTOMER_MOBILE_VERIFICATION_STORAGE_KEY);
}

export function storeCustomerMobileVerification(value: PendingCustomerMobileVerification): void {
  window.sessionStorage.setItem(CUSTOMER_MOBILE_VERIFICATION_STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(new Event(CUSTOMER_MOBILE_VERIFICATION_STORAGE_EVENT));
}

export function clearCustomerMobileVerification(): void {
  window.sessionStorage.removeItem(CUSTOMER_MOBILE_VERIFICATION_STORAGE_KEY);
  window.dispatchEvent(new Event(CUSTOMER_MOBILE_VERIFICATION_STORAGE_EVENT));
}
