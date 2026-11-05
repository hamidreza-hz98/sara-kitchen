import Box from "@mui/material/Box";
import Image from "next/image";

export type BrandMarkProps = {
  size?: number;
  symbolOnly?: boolean;
};

export function BrandMark({ size = 44, symbolOnly = false }: BrandMarkProps) {
  if (symbolOnly) {
    return (
      <Image
        alt=""
        aria-hidden="true"
        height={size}
        width={size}
        priority
        src="/icons/icon-192.png"
        style={{ display: "block", flexShrink: 0, objectFit: "contain" }}
      />
    );
  }
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
