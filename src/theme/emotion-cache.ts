import rtlPlugin from "stylis-plugin-rtl";
import { prefixer } from "stylis";

import type { AppDirection } from "./app-theme";

export const ltrEmotionCacheOptions = {
  key: "sara-mui",
  enableCssLayer: true,
} as const;

export const rtlEmotionCacheOptions = {
  key: "sara-mui-rtl",
  enableCssLayer: true,
  stylisPlugins: [prefixer, rtlPlugin],
};

export const emotionCacheOptions = ltrEmotionCacheOptions;

export function getEmotionCacheOptions(direction: AppDirection) {
  return direction === "rtl" ? rtlEmotionCacheOptions : ltrEmotionCacheOptions;
}
