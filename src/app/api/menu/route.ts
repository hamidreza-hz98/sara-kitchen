import { NextResponse } from "next/server";

import { isSupportedLocale } from "@/constants";

import { loadMenuContent } from "../../[locale]/(storefront)/menu/menu-data";
import { parseMenuQuery, type MenuSearchParams } from "../../[locale]/(storefront)/menu/menu-query";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const localeValues = url.searchParams.getAll("locale");
  const locale = localeValues[0];
  if (localeValues.length !== 1 || typeof locale !== "string" || !isSupportedLocale(locale)) {
    return NextResponse.json({ error: "invalid_locale" }, { status: 400 });
  }

  const params: MenuSearchParams = {};
  url.searchParams.forEach((value, key) => {
    if (key === "locale") return;
    const current = params[key];
    params[key] =
      typeof current === "string"
        ? [current, value]
        : Array.isArray(current)
          ? [...current, value]
          : value;
  });

  const query = parseMenuQuery(params);
  if (query.invalid) return NextResponse.json({ error: "invalid_menu_query" }, { status: 400 });
  if (!query.category) return NextResponse.json({ error: "category_required" }, { status: 400 });

  const content = await loadMenuContent(locale, query, undefined, {
    includeCategoryList: false,
    includeCategoryImages: false,
    includeCategoryShowcases: false,
  });
  return NextResponse.json(
    {
      dishes: content.dishes,
      totalItems: content.totalItems,
      totalPages: content.totalPages,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
