import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { StorefrontNotFound } from "@/components/feedback/storefront-not-found";
import { StorefrontRouteError } from "@/components/feedback/storefront-route-error";
import {
  StorefrontRouteSkeleton,
  type StorefrontSkeletonVariant,
} from "@/components/feedback/storefront-route-skeleton";
import { PROJECT_TIME_ZONE } from "@/constants";
import en from "@/locales/messages/en";
import fa from "@/locales/messages/fa";
import pt from "@/locales/messages/pt-PT";

vi.mock("@/lib/monitoring/client", () => ({ captureClientException: vi.fn() }));

function renderLocalized(locale: "en" | "pt-PT" | "fa", messages: typeof en, child: ReactNode) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone={PROJECT_TIME_ZONE}>
      {child}
    </NextIntlClientProvider>,
  );
}

describe("storefront route fallbacks", () => {
  it.each([
    "home",
    "collection",
    "dish",
    "article",
    "information",
    "checkout",
    "profile",
    "auth",
  ] as const)("keeps a nonblank %s loading layout", (variant: StorefrontSkeletonVariant) => {
    const { container, unmount } = renderLocalized(
      "en",
      en,
      <StorefrontRouteSkeleton variant={variant} />,
    );
    expect(screen.getByRole("status", { name: "Loading page" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(container.querySelectorAll(".MuiSkeleton-root").length).toBeGreaterThan(2);
    expect(container.querySelector("section[aria-busy='true']")).toBeInTheDocument();
    unmount();
  });

  it.each([
    ["en", en, "This dish is no longer available"],
    ["pt-PT", pt, "Este prato já não está disponível"],
    ["fa", fa, "این غذا دیگر در دسترس نیست"],
  ] as const)("offers localized discontinued-dish guidance in %s", (locale, messages, title) => {
    const { unmount } = renderLocalized(locale, messages, <StorefrontNotFound kind="dish" />);
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: messages.storefront.routeFeedback.menu }),
    ).toHaveAttribute("href", "/menu");
    unmount();
  });

  it("retries a recoverable error and offers the relevant escape route", async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    renderLocalized(
      "en",
      en,
      <StorefrontRouteError error={new Error("private details")} reset={reset} kind="blog" />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't load this story");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Browse stories" })).toHaveAttribute("href", "/blog");
    expect(screen.queryByText("private details")).not.toBeInTheDocument();
  });

  it.each([
    ["catalog", "We couldn't load the menu"],
    ["stories", "We couldn't load the stories"],
  ] as const)("keeps the %s index recoverable", (kind, title) => {
    const { unmount } = renderLocalized(
      "en",
      en,
      <StorefrontRouteError error={new Error("backend unavailable")} reset={vi.fn()} kind={kind} />,
    );
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    unmount();
  });
});
