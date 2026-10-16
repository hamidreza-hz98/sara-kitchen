import type { PublicContactSettings } from "@/server/modules/settings";

export function whatsappHref(whatsapp: NonNullable<PublicContactSettings["whatsapp"]>): string {
  const digits = whatsapp.number.replace(/\D/gu, "");
  const url = new URL(`https://wa.me/${digits}`);
  if (whatsapp.prefilledMessage) url.searchParams.set("text", whatsapp.prefilledMessage);
  return url.toString();
}

export function osmEmbedUrl(location: PublicContactSettings["location"]): string {
  const { latitude, longitude } = location;
  const span = 0.015;
  const url = new URL("https://www.openstreetmap.org/export/embed.html");
  url.searchParams.set(
    "bbox",
    [longitude - span, latitude - span, longitude + span, latitude + span].join(","),
  );
  url.searchParams.set("layer", "mapnik");
  url.searchParams.set("marker", `${latitude},${longitude}`);
  return url.toString();
}

export function osmDirectionsUrl(location: PublicContactSettings["location"]): string {
  const url = new URL("https://www.openstreetmap.org/directions");
  url.searchParams.set("to", `${location.latitude},${location.longitude}`);
  return url.toString();
}
