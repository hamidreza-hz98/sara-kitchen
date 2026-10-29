import TextField from "@mui/material/TextField";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { AdvancedFilters } from "@/components/ui/advanced-filters";
import messages from "@/locales/messages/en";

describe("advanced filters", () => {
  it("expands and collapses extra filters without losing their values", async () => {
    const user = userEvent.setup();
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AdvancedFilters>
          {["Search", "Status", "Category", "Sort", "Date"].map((label) => (
            <TextField key={label} label={label} />
          ))}
        </AdvancedFilters>
      </NextIntlClientProvider>,
    );
    const toggle = screen.getByRole("button", { name: "Advanced filters" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(screen.getByRole("button", { name: "Fewer filters" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    const date = screen.getByLabelText("Date");
    await user.type(date, "sample");
    await user.click(screen.getByRole("button", { name: "Fewer filters" }));
    await user.click(screen.getByRole("button", { name: "Advanced filters" }));
    expect(screen.getByLabelText("Date")).toHaveValue("sample");
  });
});
