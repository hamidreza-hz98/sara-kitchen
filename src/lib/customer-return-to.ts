/** Only known customer destinations may be used after authentication. */
export function safeCustomerReturnTo(value: string | null | undefined): string {
  if (
    !value ||
    value.length > 2048 ||
    /[\\\u0000-\u001f]/u.test(value) ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/profile";
  }

  try {
    const url = new URL(value, "https://sara-kitchen.invalid");
    if (url.origin !== "https://sara-kitchen.invalid" || url.hash) return "/profile";
    if (url.pathname === "/cart/address") return "/cart/address";
    if (url.pathname === "/profile" || url.pathname.startsWith("/profile/")) {
      return `${url.pathname}${url.search}`;
    }
  } catch {
    return "/profile";
  }

  return "/profile";
}
