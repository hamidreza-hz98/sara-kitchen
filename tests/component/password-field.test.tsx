import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { PasswordField } from "@/components/ui/password-field";
import messages from "@/locales/messages/en";

describe("PasswordField", () => {
  it("reveals each field independently without changing the value or submitting the form", async () => {
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const user = userEvent.setup();
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <form onSubmit={submit}>
          <div data-testid="first">
            <PasswordField
              label="Password"
              name="password"
              autoComplete="new-password"
              slotProps={{ htmlInput: { minLength: 15 } }}
            />
          </div>
          <div data-testid="second">
            <PasswordField label="Confirm password" name="confirm" />
          </div>
          <button type="submit">Submit</button>
        </form>
      </NextIntlClientProvider>,
    );
    const first = within(screen.getByTestId("first"));
    const second = within(screen.getByTestId("second"));
    const input = first.getByLabelText("Password") as HTMLInputElement;
    const other = second.getByLabelText("Confirm password");
    await user.type(input, "a private password");
    await user.click(first.getByRole("button", { name: "Show password" }));
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveValue("a private password");
    expect(input).toHaveAttribute("minlength", "15");
    expect(input).toHaveAttribute("autocomplete", "new-password");
    expect(other).toHaveAttribute("type", "password");
    expect(submit).not.toHaveBeenCalled();
    await user.click(first.getByRole("button", { name: "Hide password" }));
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveValue("a private password");
  });
});
