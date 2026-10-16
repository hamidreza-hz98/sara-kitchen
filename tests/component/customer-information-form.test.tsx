import { ThemeProvider } from "@mui/material/styles";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CustomerInformationForm } from "@/app/[locale]/(storefront)/profile/information/customer-information-form";
import { PROJECT_TIME_ZONE } from "@/constants";
import messages from "@/locales/messages/en";
import { appTheme } from "@/theme";

const refresh = vi.fn();
vi.mock("@/locales/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/csrf-client", () => ({
  csrfJsonHeaders: async () => ({ "content-type": "application/json" }),
}));
vi.mock("@/lib/customer-auth-sync", () => ({ broadcastCustomerAuthChange: vi.fn() }));

const initial = {
  firstName: "Sara",
  lastName: "Kazemi",
  mobile: "+351912345678",
  email: "sara@example.com",
  mobileVerifiedAt: "2026-01-01T00:00:00.000Z",
  emailVerifiedAt: "2026-01-01T00:00:00.000Z",
  marketingConsent: false,
} as const;

function renderForm() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
      <ThemeProvider theme={appTheme} defaultMode="light">
        <CustomerInformationForm initial={initial} locale="en" />
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => refresh.mockClear());
afterEach(() => vi.unstubAllGlobals());

describe("customer information form", () => {
  it("validates identity locally before contacting the API", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    renderForm();
    await user.clear(screen.getByRole("textbox", { name: /Mobile number/i }));
    await user.type(screen.getByRole("textbox", { name: /Mobile number/i }), "not-a-phone");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(
      await screen.findByText("Enter a valid Portuguese or international mobile number."),
    ).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("shows a safe conflict message without claiming a save", async () => {
    const fetcher = vi.fn(async () => new Response("{}", { status: 409 }));
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    renderForm();
    await user.clear(screen.getByRole("textbox", { name: "Email address (optional)" }));
    await user.type(
      screen.getByRole("textbox", { name: "Email address (optional)" }),
      "used@example.com",
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText(/These contact details are already in use/)).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("sends normalized contact and consent values and displays the unverified transition", async () => {
    const fetcher = vi.fn(async (_url: string, options: RequestInit) => {
      expect(options.method).toBe("PATCH");
      expect(JSON.parse(String(options.body))).toMatchObject({
        mobile: "+351923456789",
        marketingConsent: true,
      });
      return new Response(
        JSON.stringify({
          data: {
            ...initial,
            mobile: "+351923456789",
            mobileVerifiedAt: null,
            marketingConsent: true,
          },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    renderForm();
    await user.clear(screen.getByRole("textbox", { name: /Mobile number/i }));
    await user.type(screen.getByRole("textbox", { name: /Mobile number/i }), "923456789");
    await user.click(screen.getByRole("checkbox", { name: /optional marketing messages/i }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(
      await screen.findByText(/Changed contact details are now unverified/),
    ).toBeInTheDocument();
    expect(screen.getByText("Mobile: Not verified")).toBeInTheDocument();
    expect(screen.getByText("Email: Verified")).toBeInTheDocument();
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });
});
