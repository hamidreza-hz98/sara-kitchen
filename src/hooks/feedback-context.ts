"use client";

import { createContext } from "react";

export type FeedbackSeverity = "error" | "info" | "success" | "warning";

export type FeedbackNotification = {
  duration?: number | null;
  message: string;
  severity: FeedbackSeverity;
  title?: string;
};

export type FeedbackContextValue = {
  dismiss: () => void;
  notify: (notification: FeedbackNotification) => void;
};

export const FeedbackContext = createContext<FeedbackContextValue | null>(null);
