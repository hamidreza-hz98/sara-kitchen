import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { LocaleSelector } from "@/components/layout/locale-selector";
import messages from "@/locales/messages/en";

describe("language selector", () => {
  it("offers the storefront language choices with the current locale selected", async () => {
    const user = userEvent.setup();
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <LocaleSelector />
      </NextIntlClientProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Language" });
    expect(trigger).toHaveTextContent("EN");
    await user.click(trigger);
    expect(screen.getByRole("menuitem", { name: "English" })).toHaveClass("Mui-selected");
    expect(screen.getByRole("menuitem", { name: "Português" })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "فارسی" })).toBeVisible();
  });
});
