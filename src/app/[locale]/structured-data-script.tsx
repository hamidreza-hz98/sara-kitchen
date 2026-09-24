import type { StructuredDataGraph } from "@/server/modules/seo";
import { serializeStructuredData } from "@/server/modules/seo";

export type StructuredDataScriptProps = Readonly<{
  data: StructuredDataGraph | null;
}>;

/** Render validated JSON-LD while preventing user content from closing the script element. */
export function StructuredDataScript({ data }: StructuredDataScriptProps) {
  if (!data) return null;
  return (
    <script
      dangerouslySetInnerHTML={{ __html: serializeStructuredData(data) }}
      type="application/ld+json"
    />
  );
}
