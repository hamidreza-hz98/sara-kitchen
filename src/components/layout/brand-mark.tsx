import Box from "@mui/material/Box";
import Image from "next/image";

export type BrandMarkProps = {
  size?: number;
};

export function BrandMark({ size = 44 }: BrandMarkProps) {
  return (
    <Box
      aria-hidden="true"
      sx={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
        overflow: "hidden",
        border: "2px solid",
        borderColor: "primary.main",
        borderRadius: "50%",
        bgcolor: "background.paper",
      }}
    >
      <Image
        alt=""
        height={size}
        priority
        src="/brand/sara-kitchen-logo.png"
        width={size * 2}
        style={{ display: "block", height: "100%", maxWidth: "none", width: "auto" }}
      />
    </Box>
  );
}
