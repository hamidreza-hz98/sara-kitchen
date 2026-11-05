"use client";

import LanguageRounded from "@mui/icons-material/LanguageRounded";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";

import { saveBrowserLocalePreference } from "@/locales/client-preference";

export function LocaleSelector() {
  const locale = useLocale();
  const shell = useTranslations("storefront.shell");
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);
  const open = anchorElement !== null;
  const menuId = useId();

  const selectLocale = (nextLocale: string) => {
    saveBrowserLocalePreference(nextLocale as "en" | "pt-PT" | "fa");
    window.location.reload();
  };

  return (
    <>
      <Button
        aria-controls={open ? menuId : undefined}
        aria-expanded={open ? "true" : undefined}
        aria-haspopup="menu"
        aria-label={shell("language")}
        startIcon={<LanguageRounded fontSize="small" />}
        variant="outlined"
        onClick={(event) => setAnchorElement(event.currentTarget)}
        sx={{
          minWidth: 0,
          px: 1.5,
          gap: 0.75,
          "& .MuiButton-startIcon": { margin: 0 },
          borderRadius: 2,
          bgcolor: "background.paper",
        }}
      >
        {locale === "pt-PT" ? "PT" : locale === "fa" ? "فا" : "EN"}
      </Button>
      <Menu anchorEl={anchorElement} id={menuId} open={open} onClose={() => setAnchorElement(null)}>
        <MenuItem lang="en" selected={locale === "en"} onClick={() => selectLocale("en")}>
          English
        </MenuItem>
        <MenuItem lang="pt-PT" selected={locale === "pt-PT"} onClick={() => selectLocale("pt-PT")}>
          Português
        </MenuItem>
        <MenuItem dir="rtl" lang="fa" selected={locale === "fa"} onClick={() => selectLocale("fa")}>
          فارسی
        </MenuItem>
      </Menu>
    </>
  );
}
