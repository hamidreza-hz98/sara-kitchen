"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import NextLink from "next/link";
import Link from "@mui/material/Link";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import { broadcastCustomerAuthChange } from "@/lib/customer-auth-sync";
import { useRouter } from "@/locales/navigation";

type Result =
  | "successRevoked"
  | "successKept"
  | "invalidCurrent"
  | "mustDiffer"
  | "weak"
  | "expired"
  | "conflict"
  | "error"
  | "mismatch";

export function ChangePasswordForm() {
  const t = useTranslations("profile.changePassword");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    if (newPassword !== form.get("confirmPassword")) {
      setResult("mismatch");
      return;
    }
    const revokeOtherSessions = form.has("revokeOtherSessions");
    setPending(true);
    setResult(null);
    try {
      const response = await fetch("/api/auth/customer/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ currentPassword, newPassword, revokeOtherSessions }),
      });
      if (response.ok) {
        formElement.reset();
        setResult(revokeOtherSessions ? "successRevoked" : "successKept");
        broadcastCustomerAuthChange();
        router.refresh();
        return;
      }
      if (response.status === 401) setResult("expired");
      else if (response.status === 409) setResult("conflict");
      else if (response.status === 400) {
        const body: unknown = await response.json();
        const code =
          typeof body === "object" && body !== null && "error" in body
            ? (body.error as { details?: { issues?: { code?: string }[] } })?.details?.issues?.[0]
                ?.code
            : null;
        setResult(code === "current" ? "invalidCurrent" : code === "same" ? "mustDiffer" : "weak");
      } else setResult("error");
    } catch {
      setResult("error");
    } finally {
      setPending(false);
    }
  }

  const success = result === "successRevoked" || result === "successKept";
  return (
    <Stack
      component="form"
      spacing={3}
      onSubmit={(event) => {
        submit(event).catch(() => setResult("error"));
      }}
    >
      <TextField
        autoComplete="current-password"
        label={t("currentPassword")}
        name="currentPassword"
        required
        type="password"
      />
      <TextField
        autoComplete="new-password"
        helperText={t("passwordHint")}
        label={t("newPassword")}
        name="newPassword"
        required
        slotProps={{ htmlInput: { minLength: 15 } }}
        type="password"
      />
      <TextField
        autoComplete="new-password"
        label={t("confirmPassword")}
        name="confirmPassword"
        required
        type="password"
      />
      <FormControlLabel
        control={<Checkbox defaultChecked name="revokeOtherSessions" />}
        label={t("revokeOtherSessions")}
      />
      {result && (
        <Alert role="status" severity={success ? "success" : "error"}>
          {t(result)}
          {result === "expired" && (
            <>
              {" "}
              <Link component={NextLink} href="/login">
                {t("signIn")}
              </Link>
            </>
          )}
        </Alert>
      )}
      <Button disabled={pending} type="submit" variant="contained">
        {pending ? t("submitting") : t("submit")}
      </Button>
    </Stack>
  );
}
