"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import { CONTACT_NOTICE_VERSION, type SupportedLocale } from "@/constants";

export type ContactFeedback = "sent" | "invalid" | "limited" | "error";

export function ContactForm() {
  const t = useTranslations("storefront.contact");
  const locale = useLocale() as SupportedLocale;
  const [feedback, setFeedback] = useState<ContactFeedback | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    if (!String(form.get("mobile") ?? "").trim() && !String(form.get("email") ?? "").trim()) {
      setFeedback("invalid");
      return;
    }
    setPending(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/contact-submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          fullName: form.get("fullName"),
          mobile: form.get("mobile"),
          email: form.get("email"),
          message: form.get("message"),
          locale,
          pagePath: "/contact",
          privacyAccepted: form.has("privacyAccepted"),
          privacyPolicyVersion: CONTACT_NOTICE_VERSION,
          marketingAccepted: false,
          company: form.get("company") ?? "",
        }),
      });
      if (response.ok) {
        formElement.reset();
        setFeedback("sent");
      } else {
        setFeedback(
          response.status === 429 ? "limited" : response.status === 400 ? "invalid" : "error",
        );
      }
    } catch {
      setFeedback("error");
    } finally {
      setPending(false);
    }
  }

  return (
    <Box
      component="form"
      aria-labelledby="contact-form-title"
      method="post"
      action="/api/contact-submissions/form"
      onSubmit={(event) => {
        submit(event).catch(() => setFeedback("error"));
      }}
      sx={{ display: "grid", gap: 2.5 }}
    >
      <Typography component="h2" id="contact-form-title" variant="h4" sx={{ fontWeight: 800 }}>
        {t("formTitle")}
      </Typography>
      <Typography color="text.secondary">{t("formIntro")}</Typography>
      {feedback && (
        <Alert
          severity={feedback === "sent" ? "success" : "error"}
          role="status"
          aria-live="polite"
        >
          {t(`feedback.${feedback}`)}
        </Alert>
      )}
      <TextField
        name="fullName"
        label={t("name")}
        autoComplete="name"
        required
        fullWidth
        slotProps={{ htmlInput: { maxLength: 100 } }}
      />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          name="mobile"
          label={t("phone")}
          autoComplete="tel"
          type="tel"
          fullWidth
          slotProps={{ htmlInput: { maxLength: 30 } }}
        />
        <TextField
          name="email"
          label={t("email")}
          autoComplete="email"
          type="email"
          fullWidth
          slotProps={{ htmlInput: { maxLength: 254 } }}
        />
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {t("contactMethodHint")}
      </Typography>
      <TextField
        name="message"
        label={t("message")}
        multiline
        minRows={5}
        required
        fullWidth
        slotProps={{ htmlInput: { minLength: 10, maxLength: 4000 } }}
      />
      <Box
        aria-hidden="true"
        sx={{
          position: "absolute",
          insetInlineStart: "-10000px",
          width: 1,
          height: 1,
          overflow: "hidden",
        }}
      >
        <label htmlFor="contact-company">Company</label>
        <input id="contact-company" name="company" tabIndex={-1} autoComplete="off" />
      </Box>
      <FormControlLabel
        control={<Checkbox name="privacyAccepted" required />}
        label={t("consent")}
      />
      <Typography variant="caption" color="text.secondary">
        {t("privacyNotice")}
      </Typography>
      <Button
        type="submit"
        variant="contained"
        size="large"
        disabled={pending}
        sx={{ alignSelf: "start", minWidth: 180 }}
      >
        {pending ? t("sending") : t("send")}
      </Button>
    </Box>
  );
}
