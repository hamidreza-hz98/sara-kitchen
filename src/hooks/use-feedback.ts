"use client";

import { useContext } from "react";

import { FeedbackContext } from "./feedback-context";

export function useFeedback() {
  const context = useContext(FeedbackContext);

  if (context === null) {
    throw new Error("useFeedback must be used inside FeedbackProvider.");
  }

  return context;
}
