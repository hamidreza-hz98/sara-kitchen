"use client";

import { PasswordField } from "@/components/ui/password-field";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import { broadcastCustomerAuthChange } from "@/lib/customer-auth-sync";
import { csrfJsonHeaders } from "@/lib/csrf-client";
import { useRouter } from "@/locales/navigation";

type Notice = "exported" | "wrongPassword" | "expired" | "error" | null;

export function PrivacyActions() {
  const t = useTranslations("profile.securityPage");
  const router = useRouter();
  const [exportPassword, setExportPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState<"export" | "delete" | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  async function exportData(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("export");
    setNotice(null);
    try {
      const response = await fetch("/api/profile/export", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: await csrfJsonHeaders("customer"),
        body: JSON.stringify({ currentPassword: exportPassword }),
      });
      if (!response.ok) {
        setNotice(
          response.status === 403 ? "wrongPassword" : response.status === 401 ? "expired" : "error",
        );
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      try {
        const link = document.createElement("a");
        link.href = url;
        link.download = "sara-kitchen-account-data.json";
        document.body.appendChild(link);
        link.click();
        link.remove();
      } finally {
        window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      }
      setExportPassword("");
      setNotice("exported");
    } catch {
      setNotice("error");
    } finally {
      setBusy(null);
    }
  }

  async function deleteAccount() {
    setBusy("delete");
    setNotice(null);
    try {
      const response = await fetch("/api/profile", {
        method: "DELETE",
        credentials: "same-origin",
        headers: await csrfJsonHeaders("customer"),
        body: JSON.stringify({ currentPassword: deletePassword }),
      });
      if (!response.ok) {
        setNotice(
          response.status === 403 ? "wrongPassword" : response.status === 401 ? "expired" : "error",
        );
        return;
      }
      setDeletePassword("");
      setDeleteOpen(false);
      broadcastCustomerAuthChange();
      router.replace("/");
      router.refresh();
    } catch {
      setNotice("error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Stack spacing={3}>
      <Typography color="text.secondary">{t("privacyIntro")}</Typography>
      <Stack
        component="form"
        onSubmit={(event) => {
          exportData(event).catch(() => setNotice("error"));
        }}
        spacing={2}
        sx={{ maxWidth: 520 }}
      >
        <Typography component="h3" variant="h6">
          {t("exportTitle")}
        </Typography>
        <Typography color="text.secondary">{t("exportDescription")}</Typography>
        <PasswordField
          autoComplete="current-password"
          label={t("currentPassword")}
          onChange={(event) => setExportPassword(event.target.value)}
          required
          value={exportPassword}
        />
        <Button disabled={busy !== null} type="submit" variant="outlined">
          {busy === "export" ? t("working") : t("exportButton")}
        </Button>
      </Stack>
      <Stack spacing={1.5} sx={{ maxWidth: 520 }}>
        <Typography component="h3" variant="h6">
          {t("deleteTitle")}
        </Typography>
        <Typography color="text.secondary">{t("deleteDescription")}</Typography>
        <Button
          color="error"
          disabled={busy !== null}
          onClick={() => setDeleteOpen(true)}
          variant="outlined"
        >
          {t("deleteButton")}
        </Button>
      </Stack>
      {notice && (
        <Alert role="status" severity={notice === "exported" ? "success" : "error"}>
          {t(notice)}
        </Alert>
      )}
      <Dialog open={deleteOpen} onClose={() => !busy && setDeleteOpen(false)}>
        <DialogTitle>{t("confirmTitle")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography>{t("confirmDescription")}</Typography>
            <PasswordField
              autoComplete="current-password"
              label={t("currentPassword")}
              onChange={(event) => setDeletePassword(event.target.value)}
              value={deletePassword}
            />
            {notice && notice !== "exported" && (
              <Alert role="status" severity="error">
                {t(notice)}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy !== null} onClick={() => setDeleteOpen(false)}>
            {t("keepAccount")}
          </Button>
          <Button
            color="error"
            disabled={!deletePassword || busy !== null}
            onClick={() => {
              deleteAccount().catch(() => setNotice("error"));
            }}
          >
            {busy === "delete" ? t("working") : t("confirmDelete")}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
