// route-response: xml
import { SITEMAP_URL_LIMIT, renderSitemapXml, selectSitemapShard } from "@/server/modules/seo";

import { loadPublicSitemapEntries } from "../../sitemap-data";
import { sitemapXmlResponse } from "../../sitemap-response";

type SitemapShardRouteProps = Readonly<{ params: Promise<{ page: string }> }>;

export async function GET(
  _request: Request,
  { params }: SitemapShardRouteProps,
): Promise<Response> {
  const { page } = await params;
  const match = /^(0|[1-9]\d*)\.xml$/u.exec(page);
  if (!match) return sitemapXmlResponse("Not Found", 404);
  const entries = await loadPublicSitemapEntries();
  const selected = selectSitemapShard(entries, Number(match[1]), SITEMAP_URL_LIMIT);
  return selected
    ? sitemapXmlResponse(renderSitemapXml(selected))
    : sitemapXmlResponse("Not Found", 404);
}
