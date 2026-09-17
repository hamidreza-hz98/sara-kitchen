import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/locales/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { ChangePasswordForm } from "@/app/[locale]/(storefront)/profile/change-password/password-form";
import { PROJECT_TIME_ZONE } from "@/constants";
import messages from "@/locales/messages/en";

function renderForm() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
      <ChangePasswordForm />
    </NextIntlClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("customer change-password form", () => {
  it("defaults to revoking other sessions and shows the rotated-session result", async () => {
    const user = userEvent.setup();
    const submit = vi.fn(async (url: string, options: RequestInit) => {
      expect(url).toBe("/api/auth/customer/change-password");
      expect(options.method).toBe("POST");
      return new Response(JSON.stringify({ ok: true, data: { changed: true } }), { status: 200 });
    });
    vi.stubGlobal("fetch", submit);
    renderForm();
    expect(screen.getByRole("checkbox", { name: "Sign out other devices" })).toBeChecked();
    await user.type(
      screen.getByLabelText(/Current password/u),
      "A strong customer passphrase 2026",
    );
    await user.type(screen.getByLabelText(/New password/u), "A different secure passphrase 2026");
    await user.type(
      screen.getByLabelText(/Confirm new password/u),
      "A different secure passphrase 2026",
    );
    await user.click(screen.getByRole("button", { name: "Change password" }));
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    expect(JSON.parse(submit.mock.calls[0]![1]!.body as string)).toMatchObject({
      revokeOtherSessions: true,
      currentPassword: "A strong customer passphrase 2026",
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Other devices have been signed out",
    );
  });

  it("lets the customer retain other sessions and blocks mismatched confirmation", async () => {
    const user = userEvent.setup();
    const submit = vi.fn(async (url: string, options: RequestInit) => {
      expect(url).toBe("/api/auth/customer/change-password");
      expect(options.method).toBe("POST");
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", submit);
    renderForm();
    await user.click(screen.getByRole("checkbox", { name: "Sign out other devices" }));
    await user.type(
      screen.getByLabelText(/Current password/u),
      "A strong customer passphrase 2026",
    );
    await user.type(screen.getByLabelText(/New password/u), "A different secure passphrase 2026");
    await user.type(
      screen.getByLabelText(/Confirm new password/u),
      "A mismatched secure passphrase",
    );
    await user.click(screen.getByRole("button", { name: "Change password" }));
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("do not match");
    await user.clear(screen.getByLabelText(/Confirm new password/u));
    await user.type(
      screen.getByLabelText(/Confirm new password/u),
      "A different secure passphrase 2026",
    );
    await user.click(screen.getByRole("button", { name: "Change password" }));
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    expect(JSON.parse(submit.mock.calls[0]![1]!.body as string).revokeOtherSessions).toBe(false);
    expect(await screen.findByRole("status")).toHaveTextContent("other devices remain signed in");
  });
});
