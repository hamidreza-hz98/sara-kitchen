"use client";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import type { PropsWithChildren } from "react";

import { getEmotionCacheOptions } from "@/theme/emotion-cache";
import type { AppDirection } from "@/theme/app-theme";

type DirectionAwareCacheProviderProps = PropsWithChildren<{ direction: AppDirection }>;

export function DirectionAwareCacheProvider({
  children,
  direction,
}: DirectionAwareCacheProviderProps) {
  return (
    <AppRouterCacheProvider options={getEmotionCacheOptions(direction)}>
      {children}
    </AppRouterCacheProvider>
  );
}
