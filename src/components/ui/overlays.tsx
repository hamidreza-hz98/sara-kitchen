"use client";

import CloseRounded from "@mui/icons-material/CloseRounded";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { DialogProps } from "@mui/material/Dialog";
import type { DrawerProps } from "@mui/material/Drawer";
import type { ReactElement, ReactNode } from "react";
import { useId } from "react";

export type AppDialogProps = Omit<
  DialogProps,
  "aria-describedby" | "aria-labelledby" | "onClose" | "title"
> & {
  actions?: ReactNode;
  closeLabel: string;
  description?: ReactNode;
  onClose: () => void;
  title: ReactNode;
};

export function AppDialog({
  actions,
  children,
  closeLabel,
  description,
  onClose,
  title,
  ...props
}: AppDialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <Dialog
      aria-describedby={description ? descriptionId : undefined}
      aria-labelledby={titleId}
      onClose={onClose}
      {...props}
    >
      <DialogTitle id={titleId} sx={{ paddingInlineEnd: 14 }}>
        {title}
        <IconButton
          aria-label={closeLabel}
          onClick={onClose}
          sx={{ position: "absolute", insetInlineEnd: 12, insetBlockStart: 12 }}
        >
          <CloseRounded />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {description ? (
          <Typography color="text.secondary" id={descriptionId} sx={{ mb: children ? 4 : 0 }}>
            {description}
          </Typography>
        ) : null}
        {children}
      </DialogContent>
      {actions ? <DialogActions>{actions}</DialogActions> : null}
    </Dialog>
  );
}

export type AppDrawerProps = Omit<
  DrawerProps,
  "anchor" | "aria-describedby" | "aria-labelledby" | "onClose" | "title"
> & {
  closeLabel: string;
  description?: ReactNode;
  onClose: () => void;
  side?: "end" | "start";
  title: ReactNode;
};

export function AppDrawer({
  children,
  closeLabel,
  description,
  onClose,
  side = "end",
  title,
  ...props
}: AppDrawerProps) {
  const titleId = useId();
  const descriptionId = useId();
  const isStart = side === "start";
  // MUI's Drawer resolves the physical side from the active theme direction. Keep the
  // public API logical, then let MUI mirror the physical anchor once (not twice).
  const anchor = isStart ? "left" : "right";

  return (
    <Drawer
      anchor={anchor}
      onClose={onClose}
      slotProps={{
        paper: {
          "aria-describedby": description ? descriptionId : undefined,
          "aria-labelledby": titleId,
        },
      }}
      {...props}
    >
      <Box sx={{ width: { xs: "min(88vw, 360px)", sm: 400 }, p: 6 }}>
        <Stack direction="row" spacing={3} sx={{ alignItems: "flex-start" }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography component="h2" id={titleId} variant="h3">
              {title}
            </Typography>
            {description ? (
              <Typography color="text.secondary" id={descriptionId} sx={{ mt: 2 }}>
                {description}
              </Typography>
            ) : null}
          </Box>
          <IconButton aria-label={closeLabel} onClick={onClose}>
            <CloseRounded />
          </IconButton>
        </Stack>
        <Box sx={{ mt: 6 }}>{children}</Box>
      </Box>
    </Drawer>
  );
}

export type AppTooltipProps = {
  children: ReactElement;
  disabled?: boolean;
  title: ReactNode;
};

export function AppTooltip({ children, disabled = false, title }: AppTooltipProps) {
  if (!disabled) {
    return <Tooltip title={title}>{children}</Tooltip>;
  }

  return (
    <Tooltip title={title}>
      <Box component="span" sx={{ display: "inline-flex" }}>
        {children}
      </Box>
    </Tooltip>
  );
}
