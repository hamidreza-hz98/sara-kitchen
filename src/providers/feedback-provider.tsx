"use client";

import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Snackbar from "@mui/material/Snackbar";
import { useTranslations } from "next-intl";
import type { ReactNode, SyntheticEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  FeedbackContext,
  type FeedbackContextValue,
  type FeedbackNotification,
} from "@/hooks/feedback-context";

type QueuedNotification = FeedbackNotification & { id: number };

export type FeedbackProviderProps = {
  children: ReactNode;
};

export function FeedbackProvider({ children }: FeedbackProviderProps) {
  const translations = useTranslations("shared.feedback");
  const [notifications, setNotifications] = useState<readonly QueuedNotification[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const nextId = useRef(0);
  const wasOffline = useRef(false);
  const current = notifications[0];

  const dismiss = useCallback(() => {
    setNotifications((queued) => queued.slice(1));
  }, []);

  const notify = useCallback((notification: FeedbackNotification) => {
    nextId.current += 1;
    setNotifications((queued) => [...queued, { ...notification, id: nextId.current }]);
  }, []);

  useEffect(() => {
    const updateNetworkStatus = () => {
      const online = window.navigator.onLine;
      setIsOnline(online);

      if (online && wasOffline.current) {
        notify({
          message: translations("online.message"),
          severity: "success",
          title: translations("online.title"),
        });
      }

      wasOffline.current = !online;
    };

    updateNetworkStatus();
    window.addEventListener("online", updateNetworkStatus);
    window.addEventListener("offline", updateNetworkStatus);

    return () => {
      window.removeEventListener("online", updateNetworkStatus);
      window.removeEventListener("offline", updateNetworkStatus);
    };
  }, [notify, translations]);

  const value = useMemo<FeedbackContextValue>(() => ({ dismiss, notify }), [dismiss, notify]);
  const handleClose = (_event: Event | SyntheticEvent, reason?: string) => {
    if (reason !== "clickaway") {
      dismiss();
    }
  };

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {current ? (
        <Snackbar
          anchorOrigin={{ horizontal: "center", vertical: "bottom" }}
          autoHideDuration={current.duration === null ? null : (current.duration ?? 5_000)}
          key={current.id}
          open
          onClose={handleClose}
        >
          <Alert
            closeText={translations("close")}
            onClose={dismiss}
            severity={current.severity}
            sx={{ width: "min(92vw, 520px)", boxShadow: 4 }}
            variant="filled"
          >
            {current.title ? <AlertTitle>{current.title}</AlertTitle> : null}
            {current.message}
          </Alert>
        </Snackbar>
      ) : null}
      <Snackbar anchorOrigin={{ horizontal: "center", vertical: "top" }} open={!isOnline}>
        <Alert
          closeText={translations("close")}
          severity="warning"
          sx={{ width: "min(92vw, 520px)", boxShadow: 4 }}
          variant="filled"
        >
          <AlertTitle>{translations("offline.title")}</AlertTitle>
          {translations("offline.message")}
        </Alert>
      </Snackbar>
    </FeedbackContext.Provider>
  );
}
