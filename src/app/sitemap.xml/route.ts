// route-response: xml
import { getApplicationSiteUrl } from "@/server/environment";
import {
  SITEMAP_URL_LIMIT,
  renderSitemapIndexXml,
  renderSitemapXml,
  sitemapShardCount,
} from "@/server/modules/seo";

import { loadPublicSitemapEntries } from "../sitemap-data";
import { sitemapXmlResponse } from "../sitemap-response";

export async function GET(): Promise<Response> {
  const entries = await loadPublicSitemapEntries();
  const shards = sitemapShardCount(entries.length);
  return sitemapXmlResponse(
    entries.length <= SITEMAP_URL_LIMIT
      ? renderSitemapXml(entries)
      : renderSitemapIndexXml(getApplicationSiteUrl(), shards),
  );
}
