import type { Metadata } from "next";

import { ThemeShowcase } from "./theme-showcase";

export const metadata: Metadata = {
  title: "Theme showcase | Sara Kitchen",
  description: "Internal visual reference for the Sara Kitchen design system.",
  robots: { index: false, follow: false },
};

export default function ThemeShowcasePage() {
  return <ThemeShowcase />;
}
