import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import Home from "@/app/[locale]/page";
import messages from "@/locales/messages/en";

describe("Home", () => {
  it("renders the current starter page with an accessible primary heading", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages} timeZone="Europe/Lisbon">
        <Home />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Sara Kitchen is getting ready to serve you.",
    );
  });
});
