"use client";

import DarkModeRounded from "@mui/icons-material/DarkModeRounded";
import LightModeRounded from "@mui/icons-material/LightModeRounded";
import IconButton from "@mui/material/IconButton";
import { useColorScheme } from "@mui/material/styles";
import { useTranslations } from "next-intl";

export function ThemeSwitcher() {
  const { mode, systemMode, setMode } = useColorScheme();
  const t = useTranslations("shared.theme");
  const isDark = mode === "dark" || (mode !== "light" && systemMode === "dark");
  const label = isDark ? t("switchToLight") : t("switchToDark");

  return (
    <IconButton aria-label={label} title={label} onClick={() => setMode(isDark ? "light" : "dark")}>
      {isDark ? <DarkModeRounded /> : <LightModeRounded />}
    </IconButton>
  );
}
