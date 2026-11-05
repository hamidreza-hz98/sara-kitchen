"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore, type FormEvent } from "react";

import { Link as LocalizedLink } from "@/locales/navigation";
import {
  clearCustomerMobileVerification,
  getCustomerMobileVerificationSnapshot,
  parsePendingCustomerMobileVerification,
  storeCustomerMobileVerification,
  subscribeToCustomerMobileVerification,
  type PendingCustomerMobileVerification,
} from "@/lib/customer-mobile-verification";

type Failure = "invalid" | "error" | "resendError" | null;
const SHOW_DEVELOPMENT_CODE = process.env.NODE_ENV === "development";
const SERVER_STORAGE_SNAPSHOT = "__server-render__";

export function MobileVerificationForm() {
  const t = useTranslations("storefront.mobileVerification");
  const storedVerification = useSyncExternalStore(
    subscribeToCustomerMobileVerification,
    getCustomerMobileVerificationSnapshot,
    () => SERVER_STORAGE_SNAPSHOT,
  );
  const ready = storedVerification !== SERVER_STORAGE_SNAPSHOT;
  const pendingVerification = ready
    ? parsePendingCustomerMobileVerification(storedVerification)
    : null;
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [verified, setVerified] = useState(false);
  const [failure, setFailure] = useState<Failure>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingVerification) return;
    setPending(true);
    setFailure(null);
    try {
      const response = await fetch("/api/auth/customer/mobile-verification/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          challengeToken: pendingVerification.challengeToken,
          code,
        }),
      });
      if (response.ok) {
        clearCustomerMobileVerification();
        setVerified(true);
      } else {
        setFailure(response.status === 400 ? "invalid" : "error");
      }
    } catch {
      setFailure("error");
    } finally {
      setPending(false);
    }
  }

  async function resend() {
    if (!pendingVerification || resending) return;
    setResending(true);
    setFailure(null);
    try {
      const response = await fetch("/api/auth/customer/mobile-verification/resend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ challengeToken: pendingVerification.challengeToken }),
      });
      if (!response.ok) throw new Error("Mobile verification resend failed.");
      const payload = (await response.json()) as {
        data?: { mobileVerification?: PendingCustomerMobileVerification };
      };
      const nextVerification = parsePendingCustomerMobileVerification(
        JSON.stringify(payload.data?.mobileVerification),
      );
      if (!nextVerification?.developmentCode) throw new Error("No development code returned.");
      storeCustomerMobileVerification(nextVerification);
      setCode("");
    } catch {
      setFailure("resendError");
    } finally {
      setResending(false);
    }
  }

  if (!ready) return null;

  if (verified) {
    return (
      <Stack spacing={2}>
        <Alert severity="success">{t("success")}</Alert>
        <Button component={LocalizedLink} href="/login" variant="contained">
          {t("continueToLogin")}
        </Button>
      </Stack>
    );
  }

  if (!pendingVerification) {
    return (
      <Stack spacing={2}>
        <Alert severity="info">{t("noChallenge")}</Alert>
        <Button component={LocalizedLink} href="/signup" variant="contained">
          {t("signUp")}
        </Button>
      </Stack>
    );
  }

  return (
    <Stack
      component="form"
      onSubmit={(event) => {
        submit(event).catch(() => setFailure("error"));
      }}
      spacing={2.5}
    >
      <TextField
        autoComplete="one-time-code"
        autoFocus
        error={failure === "invalid"}
        helperText={failure === "invalid" ? t("invalid") : undefined}
        label={t("code")}
        onChange={(event) => {
          const normalized = event.target.value
            .normalize("NFKC")
            .replace(/[۰-۹]/gu, (digit) => String(digit.charCodeAt(0) - 0x06f0))
            .replace(/[٠-٩]/gu, (digit) => String(digit.charCodeAt(0) - 0x0660));
          setCode(normalized.replace(/\D/gu, "").slice(0, 6));
          setFailure(null);
        }}
        required
        slotProps={{ htmlInput: { inputMode: "numeric", maxLength: 6, pattern: "[0-9]{6}" } }}
        value={code}
      />
      {SHOW_DEVELOPMENT_CODE && pendingVerification.developmentCode && (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography color="text.secondary" variant="body2">
            {t("developmentCode")}
          </Typography>
          <Typography dir="ltr" sx={{ fontFamily: "monospace", fontWeight: 700 }} variant="body2">
            {pendingVerification.developmentCode}
          </Typography>
        </Stack>
      )}
      {SHOW_DEVELOPMENT_CODE && (
        <Button
          disabled={resending || pending}
          onClick={() => {
            resend().catch(() => setFailure("resendError"));
          }}
          type="button"
        >
          {resending ? t("resending") : t("resendCode")}
        </Button>
      )}
      {(failure === "error" || failure === "resendError") && (
        <Alert severity="error">{t(failure)}</Alert>
      )}
      <Button disabled={pending || code.length !== 6} type="submit" variant="contained">
        {pending ? t("verifying") : t("submit")}
      </Button>
      <Stack direction="row" spacing={0.75} sx={{ justifyContent: "center" }}>
        <Typography color="text.secondary" variant="body2">
          {t("wrongNumber")}
        </Typography>
        <Link component={LocalizedLink} href="/signup" variant="body2">
          {t("signUp")}
        </Link>
      </Stack>
    </Stack>
  );
}
