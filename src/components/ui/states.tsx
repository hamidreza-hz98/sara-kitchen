import ErrorOutlineRounded from "@mui/icons-material/ErrorOutlineRounded";
import InboxRounded from "@mui/icons-material/InboxRounded";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";
import { useId } from "react";

type StatePanelProps = {
  action?: ReactNode;
  description: ReactNode;
  icon: ReactNode;
  role?: "alert" | "status";
  title: ReactNode;
};

function StatePanel({ action, description, icon, role = "status", title }: StatePanelProps) {
  const titleId = useId();

  return (
    <Paper
      aria-labelledby={titleId}
      role={role}
      sx={{
        p: { xs: 6, sm: 8 },
        border: "1px dashed",
        borderColor: "divider",
        textAlign: "center",
      }}
    >
      <Stack spacing={3} sx={{ alignItems: "center", maxWidth: 480, mx: "auto" }}>
        <Box
          aria-hidden="true"
          sx={{ display: "inline-flex", color: "primary.dark", fontSize: 40 }}
        >
          {icon}
        </Box>
        <Typography component="h3" id={titleId} variant="h4">
          {title}
        </Typography>
        <Typography color="text.secondary">{description}</Typography>
        {action ? <Box sx={{ pt: 1 }}>{action}</Box> : null}
      </Stack>
    </Paper>
  );
}

export type EmptyStateProps = Omit<StatePanelProps, "icon" | "role"> & {
  icon?: ReactNode;
};

export function EmptyState({
  icon = <InboxRounded fontSize="inherit" />,
  ...props
}: EmptyStateProps) {
  return <StatePanel icon={icon} {...props} />;
}

export type ErrorStateProps = Omit<StatePanelProps, "icon" | "role"> & {
  icon?: ReactNode;
};

export function ErrorState({
  icon = <ErrorOutlineRounded fontSize="inherit" />,
  ...props
}: ErrorStateProps) {
  return <StatePanel icon={icon} role="alert" {...props} />;
}
