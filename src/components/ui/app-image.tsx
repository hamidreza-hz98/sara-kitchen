import Image from "next/image";
import type { ImageProps } from "next/image";

import { radiusTokens } from "@/theme";

type ImageAlt = { alt: string; decorative?: false } | { alt: ""; decorative: true };

export type AppImageProps = Omit<ImageProps, "alt"> &
  ImageAlt & {
    objectFit?: "contain" | "cover";
    radius?: keyof typeof radiusTokens;
  };

export function AppImage({
  alt,
  decorative = false,
  objectFit = "cover",
  radius = "lg",
  style,
  ...props
}: AppImageProps) {
  return (
    <Image
      alt={alt}
      aria-hidden={decorative || undefined}
      style={{ borderRadius: radiusTokens[radius], objectFit, ...style }}
      {...props}
    />
  );
}
