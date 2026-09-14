import { parseClientEnvironment } from "./client-schema";

export const clientEnvironment = parseClientEnvironment({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});
