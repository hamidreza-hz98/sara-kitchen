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
  actions,
  spacing = 2,
  visibleCounts = { xs: 1, sm: 2, lg: 4 },
}: {
  children: ReactNode;
  actions?: ReactNode;
  spacing?: number;
  visibleCounts?: Readonly<{ xs: number; sm: number; lg: number }>;
}) {
  const t = useTranslations("shared.filters");
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const items = Children.toArray(children);
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: actions ? "minmax(0, 1fr)" : "minmax(0, 1fr) auto",
          sm: actions ? "minmax(0, 1fr) auto auto" : "minmax(0, 1fr) auto",
        },
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
            lg: `repeat(${visibleCounts.lg}, minmax(0, 1fr))`,
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
                    xs: index < visibleCounts.xs ? "block" : "none",
                    sm: index < visibleCounts.sm ? "block" : "none",
                    lg: index < visibleCounts.lg ? "block" : "none",
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
            xs: items.length > visibleCounts.xs ? "inline-flex" : "none",
            sm: items.length > visibleCounts.sm ? "inline-flex" : "none",
            lg: items.length > visibleCounts.lg ? "inline-flex" : "none",
          },
        }}
      >
        {expanded ? t("less") : t("advanced")}
      </Button>
      {actions ? <Box sx={{ display: "flex", alignItems: "center" }}>{actions}</Box> : null}
    </Box>
  );
}
