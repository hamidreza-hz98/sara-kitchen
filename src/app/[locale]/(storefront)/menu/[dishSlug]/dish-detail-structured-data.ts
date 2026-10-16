import "server-only";

import { getApplicationSiteUrl } from "@/server/environment";
import { structuredDataGraphSchema, type StructuredDataGraph } from "@/server/modules/seo";

import type { DishDetailContent } from "./dish-detail-content";

/** Use the same evaluated price and availability that the page renders, never stale SEO inputs. */
export function dishDetailStructuredData(
  dish: DishDetailContent,
  site = getApplicationSiteUrl(),
  labels: Readonly<{ home: string; menu: string }> = { home: "Sara Kitchen", menu: "Menu" },
): StructuredDataGraph {
  const url = new URL(`/menu/${dish.slug}`, site).toString();
  const offer = {
    "@type": "Offer" as const,
    price: (dish.priceCents / 100).toFixed(2),
    priceCurrency: "EUR",
    availability: dish.isOrderable ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    url,
  };
  const itemListElement = [
    { "@type": "ListItem" as const, position: 1, name: labels.home, item: site },
    {
      "@type": "ListItem" as const,
      position: 2,
      name: labels.menu,
      item: new URL("/menu", site).toString(),
    },
    ...(dish.category
      ? [
          {
            "@type": "ListItem" as const,
            position: 3,
            name: dish.category.name,
            item: new URL(`/menu/category/${dish.category.slug}`, site).toString(),
          },
        ]
      : []),
    { "@type": "ListItem" as const, position: dish.category ? 4 : 3, name: dish.name, item: url },
  ];
  const common = {
    "@id": `${url}#dish`,
    name: dish.name,
    description: dish.excerpt || dish.name,
    url,
    offers: offer,
  };
  return structuredDataGraphSchema.parse({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        ...common,
        brand: { "@id": new URL("/#organization", site).toString() },
      },
      { "@type": "MenuItem", ...common },
      { "@type": "BreadcrumbList", "@id": `${url}#breadcrumbs`, itemListElement },
    ],
  });
}
