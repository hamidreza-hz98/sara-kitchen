import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";

export default function NotFound() {
  const translations = useTranslations("NotFound");

  return (
    <Stack component="main" spacing={2} sx={{ alignItems: "flex-start", p: 4 }}>
      <Typography component="h1" variant="h3">
        {translations("title")}
      </Typography>
      <Typography>{translations("description")}</Typography>
      <Button href="/" variant="contained">
        {translations("home")}
      </Button>
    </Stack>
  );
}
