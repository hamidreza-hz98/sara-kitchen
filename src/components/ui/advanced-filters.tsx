"use client";

import ExpandLessRounded from "@mui/icons-material/ExpandLessRounded";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { useTranslations } from "next-intl";
import { Children, useId, useState, type ReactNode } from "react";

/** Keep one responsive row visible and preserve the state of additional filters. */
export function AdvancedFilters({
  children,
  spacing = 2,
}: {
  children: ReactNode;
  spacing?: number;
}) {
  const t = useTranslations("shared.filters");
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const items = Children.toArray(children);
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: spacing,
        alignItems: "start",
      }}
    >
      <Box
        id={id}
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(4, minmax(0, 1fr))",
          },
          gap: spacing,
          alignItems: "start",
        }}
      >
        {items.map((item, index) => (
          <Box
            key={index}
            sx={{
              minWidth: 0,
              display: expanded
                ? "block"
                : {
                    xs: index < 1 ? "block" : "none",
                    sm: index < 2 ? "block" : "none",
                    lg: index < 4 ? "block" : "none",
                  },
              "& > .MuiFormControl-root": { width: "100%", minWidth: 0 },
            }}
          >
            {item}
          </Box>
        ))}
      </Box>
      <Button
        type="button"
        aria-expanded={expanded}
        aria-controls={id}
        endIcon={expanded ? <ExpandLessRounded /> : <ExpandMoreRounded />}
        onClick={() => setExpanded((value) => !value)}
        sx={{
          whiteSpace: "nowrap",
          display: {
            xs: items.length > 1 ? "inline-flex" : "none",
            sm: items.length > 2 ? "inline-flex" : "none",
            lg: items.length > 4 ? "inline-flex" : "none",
          },
        }}
      >
        {expanded ? t("less") : t("advanced")}
      </Button>
    </Box>
  );
}
