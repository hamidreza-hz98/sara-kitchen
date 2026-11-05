import Box, { type BoxProps } from "@mui/material/Box";

export type LiquidGlassProps = Omit<BoxProps, "sx"> & {
  /** Controls the strength of the visual treatment only; this component adds no behavior. */
  intensity?: "soft" | "standard" | "strong";
  sx?: Record<string, unknown>;
};

const intensityStyles = {
  soft: { backgroundColor: "rgba(255,255,255,.62)", backdropFilter: "blur(12px) saturate(135%)" },
  standard: {
    backgroundColor: "rgba(255,255,255,.72)",
    backdropFilter: "blur(20px) saturate(155%)",
  },
  strong: { backgroundColor: "rgba(255,255,255,.82)", backdropFilter: "blur(28px) saturate(175%)" },
} as const;

/** Reusable decorative glass surface; content and interactions remain owned by the caller. */
export function LiquidGlass({ intensity = "standard", sx, ...props }: LiquidGlassProps) {
  const styles = {
    position: "relative",
    isolation: "isolate",
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,.62)",
    borderRadius: 2.5,
    boxShadow: "0 24px 70px rgba(30,24,35,.2), inset 0 1px 0 rgba(255,255,255,.78)",
    ...intensityStyles[intensity],
    "&::before": {
      content: '""',
      position: "absolute",
      inset: 0,
      zIndex: -1,
      pointerEvents: "none",
      background:
        "linear-gradient(145deg, rgba(255,255,255,.54), rgba(255,255,255,.14) 46%, rgba(255,255,255,.26))",
    },
    "@supports not (backdrop-filter: blur(1px))": {
      backgroundColor: "rgba(255,255,255,.94)",
    },
    ...sx,
  } as BoxProps["sx"];
  return <Box {...props} sx={styles} />;
}
