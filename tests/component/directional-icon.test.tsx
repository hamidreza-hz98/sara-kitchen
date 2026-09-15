import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import { ThemeProvider } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DirectionalIcon } from "@/components";
import { appTheme, rtlAppTheme } from "@/theme";

describe("DirectionalIcon", () => {
  it("mirrors a directional glyph only in an RTL theme", () => {
    const { rerender } = render(
      <ThemeProvider theme={appTheme}>
        <DirectionalIcon mirrorInRtl testId="arrow">
          <ArrowForwardRounded />
        </DirectionalIcon>
      </ThemeProvider>,
    );

    expect(screen.getByTestId("arrow")).toHaveStyle({ transform: "none" });

    rerender(
      <ThemeProvider theme={rtlAppTheme}>
        <DirectionalIcon mirrorInRtl testId="arrow">
          <ArrowForwardRounded />
        </DirectionalIcon>
      </ThemeProvider>,
    );

    expect(screen.getByTestId("arrow")).toHaveStyle({ transform: "scaleX(-1)" });
  });

  it("preserves an intrinsic icon orientation when mirroring is disabled", () => {
    render(
      <ThemeProvider theme={rtlAppTheme}>
        <DirectionalIcon mirrorInRtl={false} testId="fixed-icon">
          <ArrowForwardRounded />
        </DirectionalIcon>
      </ThemeProvider>,
    );

    expect(screen.getByTestId("fixed-icon")).toHaveStyle({ transform: "none" });
  });
});
