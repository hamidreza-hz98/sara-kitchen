"use client";

import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRounded from "@mui/icons-material/VisibilityOffRounded";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField, { type TextFieldProps } from "@mui/material/TextField";
import { useTranslations } from "next-intl";
import { useState } from "react";

/** Password input with an independently controlled visibility toggle. */
export function PasswordField({ slotProps, disabled, ...props }: Omit<TextFieldProps, "type">) {
  const [visible, setVisible] = useState(false);
  const t = useTranslations("shared.passwordVisibility");
  return (
    <TextField
      {...props}
      disabled={disabled}
      type={visible ? "text" : "password"}
      slotProps={{
        ...slotProps,
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label={visible ? t("hide") : t("show")}
                aria-pressed={visible}
                disabled={disabled}
                edge="end"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setVisible((current) => !current)}
                type="button"
              >
                {visible ? <VisibilityOffRounded /> : <VisibilityRounded />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
