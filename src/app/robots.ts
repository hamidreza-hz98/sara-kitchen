import type { MetadataRoute } from "next";

import { getApplicationSiteUrl } from "@/server/environment";

import { createRobotsPolicy } from "./robots-policy";

export default function robots(): MetadataRoute.Robots {
  return createRobotsPolicy(process.env.NODE_ENV === "production", getApplicationSiteUrl());
}
