import { ThemeProvider } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ThemeShowcase } from "@/app/[locale]/theme-showcase/theme-showcase";
import { appTheme } from "@/theme";

describe("ThemeShowcase", () => {
  it("renders the design-system examples and opens the themed dialog", async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider theme={appTheme} defaultMode="light">
        <ThemeShowcase />
      </ThemeProvider>,
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

    await user.click(screen.getByRole("button", { name: "Preview order" }));

    expect(screen.getByRole("dialog", { name: "Preview order" })).toBeVisible();
  });
});
