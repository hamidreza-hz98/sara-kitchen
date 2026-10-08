import { ThemeProvider } from "@mui/material/styles";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CustomerManager } from "@/app/[locale]/(dashboard)/dashboard/customers/customer-manager";
import { PROJECT_TIME_ZONE } from "@/constants";
import messages from "@/locales/messages/en";
import { FeedbackProvider } from "@/providers/feedback-provider";
import { appTheme } from "@/theme";

const navigation = vi.hoisted(() => ({ query: "", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.query),
}));
vi.mock("@/locales/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
  usePathname: () => "/dashboard/customers",
  useRouter: () => ({ replace: navigation.replace }),
}));
vi.mock("@/lib/csrf-client", () => ({
  csrfJsonHeaders: async () => ({ "content-type": "application/json" }),
}));

const customer = {
  id: "507f1f77bcf86cd799439011",
  firstName: "Sara",
  lastName: "Kazemi",
  mobile: "+351939086377",
  email: "sara@example.com",
  mobileVerifiedAt: "2026-09-01T10:00:00.000Z",
  emailVerifiedAt: null,
  marketingConsent: true,
  termsAcceptedAt: "2026-09-01T10:00:00.000Z",
  status: "active",
  privacyRetentionReason: null,
  createdAt: "2026-09-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
  summary: { orderCount: 3, totalSpentCents: 4_250, lastOrderAt: "2026-10-01T10:00:00.000Z" },
} as const;

function response() {
  return new Response(
    JSON.stringify({
      data: [customer],
      meta: { pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } },
    }),
    { status: 200 },
  );
}
function renderManager(capabilities = { readSensitive: true, update: true, delete: true }) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
      <ThemeProvider theme={appTheme} defaultMode="light">
        <FeedbackProvider>
          <CustomerManager capabilities={capabilities} />
        </FeedbackProvider>
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  navigation.query = "";
  navigation.replace.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response()),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("customer manager", () => {
  it("shows order summaries and persists detail selection in the URL", async () => {
    const user = userEvent.setup();
    renderManager();
    expect((await screen.findAllByText("Sara Kazemi")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("€42.50").length).toBeGreaterThan(0);
    await user.click(screen.getAllByText("Sara Kazemi")[0]!);
    expect(navigation.replace).toHaveBeenCalledWith(
      `/dashboard/customers?customer=${customer.id}`,
      { scroll: false },
    );
  });

  it("does not expose export or status actions without dedicated permissions", async () => {
    const user = userEvent.setup();
    renderManager({ readSensitive: false, update: false, delete: false });
    await screen.findAllByText("Sara Kazemi");
    await user.click(screen.getAllByRole("button", { name: "Actions for Sara Kazemi" })[0]!);
    expect(screen.queryByText("Disable account")).not.toBeInTheDocument();
    expect(screen.queryByText("Anonymize account")).not.toBeInTheDocument();
    expect(screen.queryByText("Export account data")).not.toBeInTheDocument();
  });

  it("requires confirmation before disabling an account", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === "POST"
        ? new Response(JSON.stringify({ data: {} }), { status: 200 })
        : response(),
    );
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    renderManager();
    await screen.findAllByText("Sara Kazemi");
    await user.click(screen.getAllByRole("button", { name: "Actions for Sara Kazemi" })[0]!);
    await user.click(screen.getByText("Disable account"));
    expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
    const dialog = screen.getByRole("dialog", { name: "Disable customer account?" });
    await user.click(within(dialog).getByRole("button", { name: "Disable account" }));
    await waitFor(() =>
      expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true),
    );
  });
});
