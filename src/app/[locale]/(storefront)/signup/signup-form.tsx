"use client";

import { PasswordField } from "@/components/ui/password-field";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Link from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useLocale, useTranslations } from "next-intl";
import { getCountries, getCountryCallingCode } from "libphonenumber-js/max";
import type { CountryCode } from "libphonenumber-js";
import { useMemo, useState, type FormEvent } from "react";

import { Link as LocalizedLink, useRouter } from "@/locales/navigation";
import { storeCustomerMobileVerification } from "@/lib/customer-mobile-verification";
import { parseCustomerMobile } from "@/validations/customer-identity";

type Result = "validationError" | "rateLimited" | "networkError" | null;

function countryFlag(country: CountryCode) {
  return String.fromCodePoint(
    ...country
      .toUpperCase()
      .split("")
      .map((letter) => 127397 + letter.charCodeAt(0)),
  );
}

export function CustomerSignupForm() {
  const t = useTranslations("storefront.signup");
  const router = useRouter();
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [country, setCountry] = useState<CountryCode>("PT");
  const [mobile, setMobile] = useState("");
  const [mobileInvalid, setMobileInvalid] = useState(false);
  const [passwordMismatch, setPasswordMismatch] = useState(false);
  const countryOptions = useMemo(() => {
    const displayNames = new Intl.DisplayNames([locale], { type: "region" });
    return getCountries()
      .map((countryCode) => ({
        code: countryCode,
        name: displayNames.of(countryCode) ?? countryCode,
        callingCode: getCountryCallingCode(countryCode),
      }))
      .sort((first, second) => first.name.localeCompare(second.name, locale));
  }, [locale]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("password") !== form.get("confirmPassword")) {
      setPasswordMismatch(true);
      return;
    }
    const normalizedMobile = parseCustomerMobile(mobile, country);
    if (!normalizedMobile) {
      setMobileInvalid(true);
      return;
    }

    setPending(true);
    setResult(null);
    setMobileInvalid(false);
    try {
      const response = await fetch("/api/auth/customer/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          firstName: form.get("firstName"),
          lastName: form.get("lastName"),
          mobile: normalizedMobile,
          email: form.get("email"),
          password: form.get("password"),
          termsAccepted: form.has("termsAccepted"),
          marketingConsent: form.has("marketingConsent"),
        }),
      });
      if (response.ok) {
        const payload = (await response.json()) as {
          data?: {
            mobileVerification?: {
              challengeToken?: unknown;
              developmentCode?: unknown;
            };
          };
        };
        const verification = payload.data?.mobileVerification;
        if (
          typeof verification?.challengeToken === "string" &&
          /^[A-Za-z0-9_-]{43}$/u.test(verification.challengeToken)
        ) {
          const developmentCode =
            typeof verification.developmentCode === "string" &&
            /^\d{6}$/u.test(verification.developmentCode)
              ? verification.developmentCode
              : undefined;
          storeCustomerMobileVerification({
            challengeToken: verification.challengeToken,
            ...(developmentCode ? { developmentCode } : {}),
          });
          router.push("/verify-mobile");
          return;
        }
      }
      setResult(
        response.status === 400
          ? "validationError"
          : response.status === 429
            ? "rateLimited"
            : "networkError",
      );
    } catch {
      setResult("networkError");
    } finally {
      setPending(false);
    }
  }

  return (
    <Stack
      component="form"
      spacing={3}
      sx={{ width: "100%", minWidth: 0 }}
      onSubmit={(event) => {
        submit(event).catch(() => setResult("networkError"));
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ minWidth: 0, "& > .MuiFormControl-root": { flex: "1 1 0", minWidth: 0 } }}
      >
        <TextField
          autoComplete="given-name"
          fullWidth
          label={t("firstName")}
          name="firstName"
          required
        />
        <TextField
          autoComplete="family-name"
          fullWidth
          label={t("lastName")}
          name="lastName"
          required
        />
      </Stack>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ minWidth: 0 }}>
        <FormControl
          fullWidth
          sx={{ flex: { xs: "1 1 auto", sm: "0 0 48%" }, minWidth: 0, width: "100%" }}
        >
          <InputLabel id="signup-country-label">{t("country")}</InputLabel>
          <Select<CountryCode>
            labelId="signup-country-label"
            id="signup-country"
            label={t("country")}
            onChange={(event) => {
              setCountry(event.target.value as CountryCode);
              setMobileInvalid(false);
            }}
            renderValue={(selected) => {
              const selectedCountry = countryOptions.find((option) => option.code === selected);
              if (!selectedCountry) return selected;
              return (
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
                  <Box component="span" aria-hidden="true" sx={{ flexShrink: 0, fontSize: 20 }}>
                    {countryFlag(selectedCountry.code)}
                  </Box>
                  <Typography component="span" noWrap sx={{ flex: 1, minWidth: 0 }} variant="body2">
                    {selectedCountry.name}
                  </Typography>
                  <Typography
                    component="span"
                    dir="ltr"
                    noWrap
                    sx={{ flexShrink: 0 }}
                    variant="body2"
                  >
                    +{selectedCountry.callingCode}
                  </Typography>
                </Stack>
              );
            }}
            sx={{ minWidth: 0, "& .MuiSelect-select": { minWidth: 0, overflow: "hidden" } }}
            value={country}
          >
            {countryOptions.map((option) => (
              <MenuItem key={option.code} value={option.code} sx={{ minWidth: 0 }}>
                <Stack
                  direction="row"
                  spacing={1.25}
                  sx={{ width: "100%", alignItems: "center", minWidth: 0 }}
                >
                  <Box component="span" aria-hidden="true" sx={{ flexShrink: 0, fontSize: 20 }}>
                    {countryFlag(option.code)}
                  </Box>
                  <Typography component="span" sx={{ flex: 1, minWidth: 0 }} variant="body2">
                    {option.name}
                  </Typography>
                  <Typography
                    component="span"
                    color="text.secondary"
                    dir="ltr"
                    sx={{ flexShrink: 0 }}
                    variant="body2"
                  >
                    +{option.callingCode}
                  </Typography>
                </Stack>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          autoComplete="tel-national"
          error={mobileInvalid}
          fullWidth
          helperText={mobileInvalid ? t("invalidMobile") : undefined}
          label={t("mobile")}
          name="mobile"
          onChange={(event) => {
            setMobile(event.target.value);
            setMobileInvalid(false);
          }}
          required
          sx={{ flex: "1 1 0", minWidth: 0 }}
          type="tel"
          value={mobile}
        />
      </Stack>
      <TextField autoComplete="email" fullWidth label={t("email")} name="email" type="email" />
      <PasswordField
        autoComplete="new-password"
        fullWidth
        helperText={t("passwordHint")}
        label={t("password")}
        name="password"
        onChange={() => setPasswordMismatch(false)}
        slotProps={{ htmlInput: { minLength: 8 } }}
        required
      />
      <PasswordField
        autoComplete="new-password"
        error={passwordMismatch}
        fullWidth
        helperText={passwordMismatch ? t("passwordMismatch") : undefined}
        label={t("confirmPassword")}
        name="confirmPassword"
        onChange={() => setPasswordMismatch(false)}
        slotProps={{ htmlInput: { minLength: 8 } }}
        required
      />
      <FormControlLabel
        control={<Checkbox name="termsAccepted" required />}
        label={t("terms")}
        sx={signupCheckboxLabelSx}
      />
      <FormControlLabel
        control={<Checkbox name="marketingConsent" />}
        label={t("marketing")}
        sx={signupCheckboxLabelSx}
      />
      {result && (
        <Alert role="status" severity="error">
          {t(result)}
        </Alert>
      )}
      <Button disabled={pending} fullWidth type="submit" variant="contained">
        {pending ? t("submitting") : t("submit")}
      </Button>
      <Stack
        direction="row"
        spacing={0.75}
        sx={{ justifyContent: "center", flexWrap: "wrap", minWidth: 0, textAlign: "center" }}
      >
        <Typography color="text.secondary" variant="body2">
          {t("existingCustomer")}
        </Typography>
        <Link component={LocalizedLink} href="/login" variant="body2">
          {t("loginLink")}
        </Link>
      </Stack>
    </Stack>
  );
}

const signupCheckboxLabelSx = {
  m: 0,
  width: "100%",
  minWidth: 0,
  alignItems: "flex-start",
  gap: 0.5,
  "& .MuiCheckbox-root": { flexShrink: 0, mt: -0.5 },
  "& .MuiFormControlLabel-label": { minWidth: 0, overflowWrap: "anywhere", textAlign: "start" },
} as const;
