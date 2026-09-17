"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { ConfirmationDialog } from "@/components/feedback";
import { formatDateTime } from "@/locales/formatters";
import { resolveLocalePreference } from "@/locales/routing";
import type { ActiveSessionPage, ActiveSessionSummary } from "@/types/session";

type Principal = "admin" | "customer";

export function ActiveSessions({
  principal,
  revokeOthers,
}: {
  principal: Principal;
  revokeOthers?: () => Promise<number>;
}) {
  const t = useTranslations("shared.sessions");
  const locale = resolveLocalePreference(useLocale());
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<ActiveSessionPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmOthers, setConfirmOthers] = useState(false);
  const [notice, setNotice] = useState<"revoked" | "error" | "expired" | null>(null);
  const endpoint = `/api/auth/${principal}/sessions`;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${endpoint}?page=${page}`, {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) {
          setData(null);
          setNotice("expired");
          return;
        }
        if (!response.ok) throw new Error("Session list failed.");
        const body = (await response.json()) as { data: ActiveSessionPage };
        setData(body.data);
        setNotice((previous) => (previous === "revoked" ? previous : null));
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setData(null);
        setNotice("error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [endpoint, page, revision]);

  async function revoke(action: "one" | "others", sessionId?: string) {
    setPendingId(action === "others" ? "others" : (sessionId ?? null));
    try {
      if (action === "others") {
        if (revokeOthers) {
          await revokeOthers();
        } else {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ action: "others" }),
          });
          if (response.status === 401) {
            setData(null);
            setNotice("expired");
            return;
          }
          if (!response.ok) throw new Error("Session revocation failed.");
        }
        setNotice("revoked");
        setConfirmOthers(false);
        setLoading(true);
        if (page > 1) setPage(1);
        else setRevision((value) => value + 1);
        return;
      }
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(action === "one" ? { action, sessionId } : { action }),
      });
      if (response.status === 401) {
        setData(null);
        setNotice("expired");
        return;
      }
      if (!response.ok) throw new Error("Session revocation failed.");
      setNotice("revoked");
      setConfirmOthers(false);
      setLoading(true);
      if (data && page > 1 && data.sessions.length === 1) setPage(page - 1);
      else setRevision((value) => value + 1);
    } catch {
      setNotice("error");
    } finally {
      setPendingId(null);
    }
  }

  const date = (value: string) => formatDateTime(new Date(value), locale);
  const device = (session: ActiveSessionSummary) =>
    `${t(`browser.${session.browser}`)} · ${t(`platform.${session.platform}`)}`;

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 2,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography color="text.secondary">{t("description")}</Typography>
        <Button
          color="error"
          disabled={loading || pendingId !== null || !data || data.total <= 1}
          onClick={() => setConfirmOthers(true)}
          variant="outlined"
        >
          {t("revokeOthers")}
        </Button>
      </Box>
      {notice && (
        <Alert severity={notice === "revoked" ? "success" : "error"} role="status">
          {t(notice)}
          {notice === "expired" && (
            <Button
              component={NextLink}
              href={principal === "admin" ? "/authentication" : "/login"}
            >
              {t("signIn")}
            </Button>
          )}
        </Alert>
      )}
      {loading ? <CircularProgress aria-label={t("loading")} /> : null}
      {!loading && data?.sessions.length === 0 ? <Typography>{t("empty")}</Typography> : null}
      {!loading &&
        data?.sessions.map((session) => (
          <Box
            key={session.id}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 3,
              p: 3,
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              gap: 2,
            }}
          >
            <Stack spacing={0.5}>
              <Typography sx={{ fontWeight: 700 }}>
                {device(session)} {session.current ? `— ${t("current")}` : ""}
              </Typography>
              <Typography color="text.secondary" variant="body2">
                {t("started", { date: date(session.createdAt) })}
              </Typography>
              <Typography color="text.secondary" variant="body2">
                {t("lastSeen", { date: date(session.lastSeenAt) })}
              </Typography>
              <Typography color="text.secondary" variant="body2">
                {t("expires", { date: date(session.expiresAt) })}
              </Typography>
              <Typography color="text.secondary" variant="body2">
                {t(session.persistent ? "persistent" : "browserSession")}
              </Typography>
            </Stack>
            {!session.current && (
              <Button
                color="error"
                disabled={pendingId !== null}
                onClick={() => {
                  revoke("one", session.id).catch(() => setNotice("error"));
                }}
              >
                {pendingId === session.id ? t("revoking") : t("revokeOne")}
              </Button>
            )}
          </Box>
        ))}
      {data && data.total > data.pageSize && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Button
            disabled={page <= 1 || loading}
            onClick={() => {
              setLoading(true);
              setPage((value) => value - 1);
            }}
          >
            {t("previous")}
          </Button>
          <Typography>{t("page", { page })}</Typography>
          <Button
            disabled={!data.hasMore || loading}
            onClick={() => {
              setLoading(true);
              setPage((value) => value + 1);
            }}
          >
            {t("next")}
          </Button>
        </Box>
      )}
      <ConfirmationDialog
        cancelLabel={t("cancel")}
        closeLabel={t("close")}
        confirmLabel={t("confirmOthers")}
        danger
        description={t("confirmDescription")}
        loading={pendingId === "others"}
        open={confirmOthers}
        title={t("confirmTitle")}
        onCancel={() => setConfirmOthers(false)}
        onConfirm={() => {
          revoke("others").catch(() => setNotice("error"));
        }}
      />
    </Stack>
  );
}
