import { ThemeProvider } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { ThemeShowcase } from "@/app/[locale]/theme-showcase/theme-showcase";
import { PROJECT_TIME_ZONE } from "@/constants";
import messages from "@/locales/messages/en";
import { FeedbackProvider } from "@/providers/feedback-provider";
import { appTheme } from "@/theme";

describe("ThemeShowcase", () => {
  it("renders the design-system examples and opens the themed dialog", async () => {
    const user = userEvent.setup();

    render(
      <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
        <ThemeProvider theme={appTheme} defaultMode="light">
          <FeedbackProvider>
            <ThemeShowcase />
          </FeedbackProvider>
        </ThemeProvider>
      </NextIntlClientProvider>,
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Warm hospitality, translated into every component.",
      }),
    ).toBeVisible();
    expect(screen.getByText("Primary coral")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Accessible product primitives" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Public dish name" })).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Dish pages" })).toBeVisible();
    expect(screen.getByRole("article")).toBeVisible();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show success" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Preview order" }));

    expect(screen.getByRole("dialog", { name: "Preview order" })).toBeVisible();
  }, 10_000);
});
