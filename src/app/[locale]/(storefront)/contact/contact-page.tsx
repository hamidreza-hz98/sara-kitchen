import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import InstagramIcon from "@mui/icons-material/Instagram";
import LocationOnRoundedIcon from "@mui/icons-material/LocationOnRounded";
import PhoneRoundedIcon from "@mui/icons-material/PhoneRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";

import { CONTACT_WEEKDAYS } from "@/server/modules/settings";

import type { ContactPageData } from "./contact-data";
import { ContactForm } from "./contact-form";
import { osmDirectionsUrl, osmEmbedUrl, whatsappHref } from "./contact-links";

export function ContactPage({ data }: { data: ContactPageData }) {
  const t = useTranslations("storefront.contact");
  const { contact, social } = data;
  const sampleSocials = [
    {
      platform: "instagram",
      label: "@sarakitchen.porto",
      href: "https://www.instagram.com/sarakitchen.porto/",
    },
    { platform: "telegram", label: "@sara_kitchen", href: "https://t.me/sara_kitchen" },
  ];
  const map = contact?.map;
  const mapUrl =
    contact && map?.provider === "leaflet" ? osmEmbedUrl(contact.location) : map?.embedUrl;
  const directions = contact ? (map?.directionsUrl ?? osmDirectionsUrl(contact.location)) : null;
  const address = contact
    ? [
        contact.address.line1,
        contact.address.line2,
        `${contact.address.postalCode} ${contact.address.city}`,
        contact.address.country,
      ]
        .filter(Boolean)
        .join(", ")
    : null;

  return (
    <Box sx={{ bgcolor: "background.default", pb: { xs: 9, md: 14 } }}>
      <Box
        sx={{
          background: "linear-gradient(150deg, #ffe6de 0%, #f5d5d2 45%, #f3e5f0 100%)",
          py: { xs: 3.5, md: 8 },
          "html.dark &": {
            background: "linear-gradient(150deg, #321b1b 0%, #432424 45%, #321b1b 100%)",
          },
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1.05fr" },
              gap: { xs: 3, md: 7 },
              alignItems: "center",
            }}
          >
            <Stack spacing={{ xs: 1.5, md: 2.5 }}>
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ alignItems: "center", mb: { xs: 0.5, md: 1 } }}
                aria-hidden="true"
              >
                <Box
                  component="img"
                  src="/images/home/tahdig.webp"
                  alt=""
                  sx={{
                    width: { xs: 92, md: 132 },
                    height: { xs: 92, md: 132 },
                    objectFit: "cover",
                    borderRadius: "50%",
                    border: "4px solid white",
                    boxShadow: "0 8px 20px #24243a24",
                  }}
                />
                <Box
                  component="img"
                  src="/images/home/persian-spices.webp"
                  alt=""
                  sx={{
                    width: { xs: 70, md: 98 },
                    height: { xs: 70, md: 98 },
                    objectFit: "cover",
                    borderRadius: "50%",
                    border: "4px solid white",
                    boxShadow: "0 8px 20px #24243a24",
                  }}
                />
              </Stack>
              <Typography
                sx={{
                  color: "primary.dark",
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                {t("eyebrow")}
              </Typography>
              <Typography
                component="h1"
                variant="h2"
                sx={{ fontWeight: 800, fontSize: { xs: "2rem", md: "3.6rem" }, lineHeight: 1.1 }}
              >
                {t("title")}
              </Typography>
              <Typography sx={{ fontSize: { xs: ".95rem", md: "1.15rem" }, lineHeight: 1.75 }}>
                {t("intro")}
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "repeat(2, minmax(0, 1fr))",
                    sm: "repeat(3, minmax(0, 1fr))",
                  },
                  gap: 1.25,
                  pt: { xs: 1.5, md: 1 },
                }}
              >
                {contact?.phones.map((phone) => (
                  <Paper
                    key={phone.number}
                    component="a"
                    href={`tel:${phone.number}`}
                    sx={{
                      p: { xs: 1.5, md: 2 },
                      borderRadius: 1.5,
                      textDecoration: "none",
                      color: "inherit",
                      overflowWrap: "anywhere",
                    }}
                  >
                    <PhoneRoundedIcon color="primary" />
                    <Typography
                      variant="caption"
                      sx={{ display: "block", textTransform: "uppercase", mt: 1 }}
                    >
                      {phone.label}
                    </Typography>
                    <Typography sx={{ fontWeight: 700 }}>{phone.number}</Typography>
                  </Paper>
                ))}
                {contact?.email && (
                  <Paper
                    component="a"
                    href={`mailto:${contact.email}`}
                    sx={{
                      p: { xs: 1.5, md: 2 },
                      borderRadius: 1.5,
                      textDecoration: "none",
                      color: "inherit",
                      overflowWrap: "anywhere",
                    }}
                  >
                    <EmailRoundedIcon color="primary" />
                    <Typography
                      variant="caption"
                      sx={{ display: "block", textTransform: "uppercase", mt: 1 }}
                    >
                      {t("email")}
                    </Typography>
                    <Typography sx={{ fontWeight: 700 }}>{contact.email}</Typography>
                  </Paper>
                )}
                {contact?.whatsapp && (
                  <Paper
                    component="a"
                    href={whatsappHref(contact.whatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      p: { xs: 1.5, md: 2 },
                      borderRadius: 1.5,
                      textDecoration: "none",
                      color: "inherit",
                      overflowWrap: "anywhere",
                    }}
                  >
                    <WhatsAppIcon color="primary" />
                    <Typography
                      variant="caption"
                      sx={{ display: "block", textTransform: "uppercase", mt: 1 }}
                    >
                      {t("whatsapp")}
                    </Typography>
                    <Typography sx={{ fontWeight: 700 }}>{contact.whatsapp.number}</Typography>
                  </Paper>
                )}
                {(social?.links.length
                  ? social.links
                  : sampleSocials.map((item) => ({
                      ...item,
                      target: "_blank",
                      rel: "noopener noreferrer",
                    }))
                ).map((link) => (
                  <Paper
                    key={`${link.platform}-${link.href}`}
                    component="a"
                    href={link.href}
                    target={link.target}
                    rel={link.rel}
                    sx={{
                      p: { xs: 1.5, md: 2 },
                      borderRadius: 1.5,
                      textDecoration: "none",
                      color: "inherit",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {link.platform === "instagram" ? (
                      <InstagramIcon color="primary" />
                    ) : link.platform === "telegram" ? (
                      <SendRoundedIcon color="primary" />
                    ) : (
                      <PublicRoundedIcon color="primary" />
                    )}
                    <Typography
                      variant="caption"
                      sx={{ display: "block", textTransform: "uppercase", mt: 1 }}
                    >
                      {link.platform}
                    </Typography>
                    <Typography sx={{ fontWeight: 700 }}>{link.label}</Typography>
                  </Paper>
                ))}
              </Box>
              {!contact && !social?.links.length && (
                <Typography color="text.secondary">{t("detailsUnavailable")}</Typography>
              )}
            </Stack>
            <Paper
              sx={{
                p: { xs: 2, md: 4 },
                borderRadius: 2,
                boxShadow: "0 22px 65px #2c2c4720",
                position: "relative",
                background:
                  "linear-gradient(#ffffffd9,#ffffffd9), url('/images/blog/persian-rice-table.webp') center/cover",
              }}
            >
              <ContactForm />
            </Paper>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ mt: { xs: 5, md: 9 } }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "0.8fr 1.2fr" },
            gap: 4,
            alignItems: "start",
          }}
        >
          <Stack spacing={2}>
            <Typography
              component="h2"
              variant="h4"
              sx={{ fontWeight: 800, fontSize: { xs: "1.55rem", md: "2.1rem" } }}
            >
              {t("visitTitle")}
            </Typography>
            {contact ? (
              <>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: "start" }}>
                  <LocationOnRoundedIcon color="primary" />
                  <Typography>{address}</Typography>
                </Stack>
                <Typography color="text.secondary">
                  {contact.serviceArea.name}
                  {contact.serviceArea.description ? ` — ${contact.serviceArea.description}` : ""}
                </Typography>
                {directions && (
                  <Button
                    href={directions}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="outlined"
                    sx={{ alignSelf: "start" }}
                  >
                    {t("directions")}
                  </Button>
                )}
                <Box component="section" aria-labelledby="contact-hours-heading">
                  <Stack direction="row" spacing={1} sx={{ mb: 2, alignItems: "center" }}>
                    <AccessTimeRoundedIcon color="primary" />
                    <Typography
                      component="h3"
                      id="contact-hours-heading"
                      variant="h6"
                      sx={{ fontWeight: 800 }}
                    >
                      {t("hoursTitle")}
                    </Typography>
                  </Stack>
                  <Box component="dl" sx={{ m: 0 }}>
                    {CONTACT_WEEKDAYS.map((day) => {
                      const record = contact.businessHours.find((entry) => entry.day === day);
                      const hours = record?.periods.length
                        ? record.periods
                            .map(({ opensAt, closesAt }) => `${opensAt}–${closesAt}`)
                            .join(", ")
                        : t("closed");
                      return (
                        <Stack
                          key={day}
                          direction="row"
                          sx={{
                            justifyContent: "space-between",
                            gap: 2,
                            py: 0.75,
                            borderBottom: "1px solid",
                            borderColor: "divider",
                          }}
                        >
                          <Typography component="dt">{t(`days.${day}`)}</Typography>
                          <Typography component="dd" sx={{ m: 0, textAlign: "end" }}>
                            {hours}
                          </Typography>
                        </Stack>
                      );
                    })}
                  </Box>
                  {contact.businessHoursNote && (
                    <Typography color="text.secondary" sx={{ mt: 2 }}>
                      {contact.businessHoursNote}
                    </Typography>
                  )}
                </Box>
              </>
            ) : (
              <Typography color="text.secondary">{t("locationUnavailable")}</Typography>
            )}
          </Stack>
          {mapUrl && (
            <Paper
              component="section"
              aria-label={t("mapTitle")}
              sx={{ overflow: "hidden", borderRadius: 2 }}
            >
              <Box
                component="iframe"
                title={map?.label || t("mapTitle")}
                src={mapUrl}
                loading="lazy"
                referrerPolicy="no-referrer"
                sx={{ width: "100%", height: { xs: 320, md: 470 }, border: 0, display: "block" }}
              />
              <Stack
                direction="row"
                sx={{
                  justifyContent: "space-between",
                  alignItems: "center",
                  p: 2,
                  gap: 1,
                  flexWrap: "wrap",
                }}
              >
                <Typography variant="caption">
                  {map?.provider === "leaflet" ? t("osmAttribution") : t("googleAttribution")}
                </Typography>
                <Button
                  href={
                    map?.provider === "leaflet"
                      ? "https://www.openstreetmap.org/copyright"
                      : "https://www.google.com/maps"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  size="small"
                >
                  {t("mapProvider")}
                </Button>
              </Stack>
            </Paper>
          )}
        </Box>
      </Container>
    </Box>
  );
}
