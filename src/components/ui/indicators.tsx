import Badge from "@mui/material/Badge";
import type { BadgeProps } from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import type { ChipProps } from "@mui/material/Chip";
import Skeleton from "@mui/material/Skeleton";
import type { SkeletonProps } from "@mui/material/Skeleton";

export type NotificationBadgeProps = BadgeProps & {
  badgeLabel: string;
};

export function NotificationBadge({ badgeLabel, ...props }: NotificationBadgeProps) {
  return <Badge aria-label={badgeLabel} {...props} />;
}

export type StatusChipProps = ChipProps;

export function StatusChip(props: StatusChipProps) {
  return <Chip {...props} />;
}

export type ContentSkeletonProps = Omit<SkeletonProps, "aria-label" | "children"> & {
  label: string;
};

export function ContentSkeleton({ label, ...props }: ContentSkeletonProps) {
  return (
    <Box aria-label={label} aria-live="polite" role="status">
      <Box
        component="span"
        sx={{
          position: "absolute",
          width: "1px",
          height: "1px",
          p: 0,
          m: -1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {label}
      </Box>
      <Skeleton aria-hidden="true" {...props} />
    </Box>
  );
}
