"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useLocale, useTranslations } from "next-intl";

import type { SupportedLocale } from "@/constants";
import { formatEuro } from "@/locales/formatters";
import { radiusTokens } from "@/theme";

import type { MenuContent, MenuDish } from "./menu-data";
import styles from "./menu-page.module.css";
import { menuHref, type MenuQuery } from "./menu-query";

type MenuPageResponse = Pick<MenuContent, "dishes" | "totalItems" | "totalPages">;

function DishCard({ dish, view }: { dish: MenuDish; view: MenuQuery["view"] }) {
  const locale = useLocale() as SupportedLocale;
  const t = useTranslations("storefront.menu");
  return (
    <Paper
      component="article"
      variant="outlined"
      className={`${styles.dishCard} ${view === "list" ? styles.dishCardList : styles.dishCardGrid}`}
      sx={{ borderRadius: `${radiusTokens.md}px` }}
    >
      {dish.image ? (
        <Box
          component="img"
          src={dish.image.url}
          alt={dish.image.alt}
          loading="lazy"
          decoding="async"
          className={styles.dishImage}
        />
      ) : (
        <Box aria-hidden="true" className={`${styles.dishImage} ${styles.dishImageFallback}`} />
      )}
      <Box className={styles.dishBody}>
        <Box className={styles.dishCopy}>
          <Typography component="h3" variant="subtitle1" className={styles.dishName}>
            {dish.name}
          </Typography>
          {dish.excerpt && (
            <Typography color="text.secondary" variant="body2" className={styles.dishExcerpt}>
              {dish.excerpt}
            </Typography>
          )}
          {!dish.isOrderable && (
            <Typography color="text.secondary" variant="caption">
              {t("unavailable")}
            </Typography>
          )}
        </Box>
        <Box className={styles.dishFooter}>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "baseline", minWidth: 0 }}>
            <Typography color="primary.dark" sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>
              {formatEuro(dish.priceCents, locale)}
            </Typography>
            {dish.compareAtPriceCents !== null && (
              <Typography component="s" color="text.secondary" variant="caption" noWrap>
                {formatEuro(dish.compareAtPriceCents, locale)}
              </Typography>
            )}
          </Stack>
          <Button
            href={`/menu/${dish.slug}`}
            aria-label={`${t("viewDish")}: ${dish.name}`}
            variant="contained"
            size="small"
            className={styles.dishAction}
          >
            {t("viewDish")}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}

export function MenuInfiniteResults({
  initialDishes,
  query,
  totalPages: initialTotalPages,
}: {
  initialDishes: readonly MenuDish[];
  query: MenuQuery;
  totalPages: number;
}) {
  const locale = useLocale() as SupportedLocale;
  const t = useTranslations("storefront.menu");
  const [dishes, setDishes] = useState<readonly MenuDish[]>(initialDishes);
  const [page, setPage] = useState(query.page);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const hasMore = page < totalPages;

  const loadMore = useCallback(async () => {
    if (loadingRef.current || page >= totalPages) return;
    loadingRef.current = true;
    setLoading(true);
    setLoadError(false);

    try {
      const nextPage = page + 1;
      const url = new URL(menuHref(query, { page: nextPage }), window.location.origin);
      url.searchParams.set("locale", locale);
      const response = await fetch(`/api/menu?${url.searchParams.toString()}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("menu_page_load_failed");

      const data = (await response.json()) as MenuPageResponse;
      if (
        !Array.isArray(data.dishes) ||
        !Number.isSafeInteger(data.totalPages) ||
        !Number.isSafeInteger(data.totalItems)
      ) {
        throw new Error("menu_page_response_invalid");
      }

      setDishes((current) => {
        const knownSlugs = new Set(current.map((dish) => dish.slug));
        return [...current, ...data.dishes.filter((dish) => !knownSlugs.has(dish.slug))];
      });
      setPage(nextPage);
      setTotalPages(data.totalPages);
    } catch {
      setLoadError(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [locale, page, query, totalPages]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore().catch(() => undefined);
      },
      { rootMargin: "480px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return (
    <>
      <Box
        className={`${styles.dishGrid} ${query.view === "list" ? styles.dishList : styles.dishTiles}`}
      >
        {dishes.map((dish) => (
          <DishCard dish={dish} view={query.view} key={dish.slug} />
        ))}
      </Box>
      {hasMore && (
        <Box className={styles.loadMoreArea}>
          <div ref={sentinelRef} className={styles.scrollSentinel} aria-hidden="true" />
          {loading ? (
            <Stack
              direction="row"
              spacing={1}
              role="status"
              aria-live="polite"
              className={styles.loadingStatus}
            >
              <CircularProgress size={18} aria-hidden="true" />
              <Typography variant="body2">{t("loadingMore")}</Typography>
            </Stack>
          ) : loadError ? (
            <Stack spacing={1} sx={{ alignItems: "center" }}>
              <Typography color="error" variant="body2" role="alert">
                {t("loadMoreError")}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() => void loadMore().catch(() => undefined)}
              >
                {t("retryLoadMore")}
              </Button>
            </Stack>
          ) : (
            <Button
              variant="text"
              size="small"
              onClick={() => void loadMore().catch(() => undefined)}
            >
              {t("loadMore")}
            </Button>
          )}
        </Box>
      )}
    </>
  );
}
