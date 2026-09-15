"use client";

import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import type { ReactNode } from "react";

type DirectionalIconProps = {
  children: ReactNode;
  mirrorInRtl: boolean;
  testId?: string;
};

export function DirectionalIcon({ children, mirrorInRtl, testId }: DirectionalIconProps) {
  const theme = useTheme();
  const shouldMirror = mirrorInRtl && theme.direction === "rtl";

  return (
    <Box
      aria-hidden="true"
      data-mirror-in-rtl={mirrorInRtl}
      {...(testId ? { "data-testid": testId } : {})}
      component="span"
      sx={{
        display: "inline-flex",
        flexShrink: 0,
        transform: shouldMirror ? "scaleX(-1)" : "none",
        transition: "transform 0s",
      }}
    >
      {children}
    </Box>
  );
}
