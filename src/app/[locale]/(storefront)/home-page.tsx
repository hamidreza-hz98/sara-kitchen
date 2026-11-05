import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import ArticleRounded from "@mui/icons-material/ArticleRounded";
import FavoriteRounded from "@mui/icons-material/FavoriteRounded";
import LocalFireDepartmentRounded from "@mui/icons-material/LocalFireDepartmentRounded";
import LocalShippingRounded from "@mui/icons-material/LocalShippingRounded";
import PercentRounded from "@mui/icons-material/PercentRounded";
import RestaurantRounded from "@mui/icons-material/RestaurantRounded";
import SpaRounded from "@mui/icons-material/SpaRounded";
import StarRounded from "@mui/icons-material/StarRounded";
import Box from "@mui/material/Box";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import type { SupportedLocale } from "@/constants";
import { Link } from "@/locales/navigation";
import { formatEuro } from "@/locales/formatters";

import { HomeHero } from "./home-hero";
import { EMPTY_HOME_CONTENT, type HomeContent, type HomeDish } from "./home-content";
import styles from "./home-page.module.css";

const dishImages: Readonly<Record<string, string>> = {
  "ghormeh-sabzi": "/images/home/ghormeh-sabzi.webp",
  fesenjan: "/images/home/fesenjan.webp",
  gheimeh: "/images/home/gheimeh.webp",
  "joojeh-kebab": "/images/home/hero-grill.webp",
  "adas-polo-meat": "/images/home/adas-polo.webp",
  "adas-polo": "/images/home/adas-polo.webp",
};

function dishImage(dish: HomeDish): string {
  return dish.image?.url ?? dishImages[dish.slug] ?? "/images/home/ghormeh-sabzi.webp";
}

function salePercent(dish: HomeDish): number {
  const original = dish.originalPriceCents;
  if (original === null || original <= 0) return 0;
  return Math.max(0, Math.round(((original - dish.priceCents) / original) * 100));
}

function SectionHeading({
  action,
  href,
  icon,
  title,
}: {
  action?: string;
  href?: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className={styles.sectionHeading}>
      <div className={styles.sectionTitle}>
        <span className={styles.headingIcon} aria-hidden="true">
          {icon}
        </span>
        <h2>{title}</h2>
      </div>
      {href && action && (
        <Link className={styles.viewAll} href={href}>
          {action}
          <ArrowForwardRounded aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

function PromoTile({
  image,
  href,
  title,
  wide = false,
}: {
  image: string;
  href: string;
  title: string;
  wide?: boolean;
}) {
  return (
    <Link className={`${styles.promoTile} ${wide ? styles.promoTileWide : ""}`} href={href}>
      <Box
        alt=""
        aria-hidden="true"
        className={styles.promoImage}
        component="img"
        loading="lazy"
        src={image}
      />
      <span className={styles.promoShade} aria-hidden="true" />
      <span className={styles.promoTitle}>{title}</span>
      <ArrowForwardRounded className={styles.promoArrow} aria-hidden="true" />
    </Link>
  );
}

function FeaturedCard({
  dish,
  locale,
  saleLabel,
  unavailableLabel,
  viewDishLabel,
}: {
  dish: HomeDish;
  locale: SupportedLocale;
  saleLabel: string;
  unavailableLabel: string;
  viewDishLabel: string;
}) {
  const sale = salePercent(dish);
  return (
    <article className={styles.featuredCard}>
      <Link className={styles.featuredLink} href={`/menu/${dish.slug}`}>
        <Box
          alt={dish.image?.alt || dish.name}
          className={styles.featuredImage}
          component="img"
          loading="lazy"
          src={dishImage(dish)}
        />
        <span className={styles.featuredShade} aria-hidden="true" />
        <span className={styles.pricePill}>{formatEuro(dish.priceCents, locale)}</span>
        <span className={styles.salePill}>{saleLabel.replace("{percent}", String(sale))}</span>
        {dish.available === false && (
          <span className={styles.unavailablePill}>{unavailableLabel}</span>
        )}
        <div className={styles.featuredInfo}>
          <h3>{dish.name}</h3>
          {dish.excerpt && <p>{dish.excerpt}</p>}
          <span className={styles.cardAction}>
            <ArrowForwardRounded aria-hidden="true" />
            {viewDishLabel}
          </span>
        </div>
      </Link>
    </article>
  );
}

function DealCard({
  dish,
  locale,
  saleLabel,
  unavailableLabel,
}: {
  dish: HomeDish;
  locale: SupportedLocale;
  saleLabel: string;
  unavailableLabel: string;
}) {
  const referencePrice = dish.originalPriceCents ?? dish.priceCents;
  return (
    <article className={styles.dealCard}>
      <Link className={styles.dealLink} href={`/menu/${dish.slug}`}>
        <div className={styles.dealImageWrap}>
          <Box
            alt={dish.image?.alt || dish.name}
            className={styles.dealImage}
            component="img"
            loading="lazy"
            src={dishImage(dish)}
          />
          <span className={styles.dealPill}>
            {saleLabel.replace("{percent}", String(salePercent(dish)))}
          </span>
          {dish.available === false && (
            <span className={styles.dealUnavailable}>{unavailableLabel}</span>
          )}
        </div>
        <h3>{dish.name}</h3>
        <p className={styles.dealPrice}>
          <span>{formatEuro(dish.priceCents, locale)}</span>
          <s>{formatEuro(referencePrice, locale)}</s>
        </p>
      </Link>
    </article>
  );
}

function BestSellerRow({ dish, rank }: { dish: HomeDish; rank: number }) {
  return (
    <Link className={styles.bestSellerRow} href={`/menu/${dish.slug}`}>
      <span className={styles.rank}>{String(rank).padStart(2, "0")}</span>
      <Box
        alt=""
        aria-hidden="true"
        className={styles.bestSellerImage}
        component="img"
        loading="lazy"
        src={dishImage(dish)}
      />
      <span className={styles.bestSellerCopy}>
        <strong>{dish.name}</strong>
        {dish.excerpt && <small>{dish.excerpt}</small>}
      </span>
      <ArrowForwardRounded className={styles.rowArrow} aria-hidden="true" />
    </Link>
  );
}

export function HomePage({ content = EMPTY_HOME_CONTENT }: { content?: HomeContent }) {
  const t = useTranslations("storefront.home");
  const locale = useLocale() as SupportedLocale;
  const featured = content.featured.slice(0, 6);
  const deals = (content.discounted.length > 0 ? content.discounted : featured).slice(0, 5);
  const mainCoursesHref = content.categories.some((item) => item.slug === "main-courses")
    ? "/menu/category/main-courses"
    : "/menu";
  const kebabsHref = content.categories.some((item) => item.slug === "kebabs")
    ? "/menu/category/kebabs"
    : "/menu";
  const leadPromo = content.banners[0];
  const benefits =
    content.benefits.length > 0
      ? content.benefits.slice(0, 4).map((item, index) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          icon: [
            <RestaurantRounded key="taste" />,
            <LocalShippingRounded key="delivery" />,
            <SpaRounded key="fresh" />,
            <FavoriteRounded key="family" />,
          ][index % 4],
        }))
      : [
          {
            id: "taste",
            title: t("benefitTaste"),
            description: t("benefitTasteDescription"),
            icon: <RestaurantRounded />,
          },
          {
            id: "delivery",
            title: t("benefitDelivery"),
            description: t("benefitDeliveryDescription"),
            icon: <LocalShippingRounded />,
          },
          {
            id: "fresh",
            title: t("benefitFresh"),
            description: t("benefitFreshDescription"),
            icon: <SpaRounded />,
          },
          {
            id: "family",
            title: t("benefitFamily"),
            description: t("benefitFamilyDescription"),
            icon: <FavoriteRounded />,
          },
        ];
  const stories =
    content.blogs.length > 0
      ? content.blogs.slice(0, 4).map((item, index) => ({
          id: item.id,
          href: `/blog/${item.slug}`,
          title: item.title,
          excerpt: item.excerpt,
          image:
            item.image?.url ??
            (index === 0 ? "/images/home/tahdig.webp" : "/images/home/persian-spices.webp"),
          readTimeMinutes: item.readTimeMinutes,
        }))
      : [
          {
            id: "tahdig",
            href: "/blog",
            title: t("tahdigStoryTitle"),
            excerpt: t("tahdigStoryDescription"),
            image: "/images/home/tahdig.webp",
            readTimeMinutes: 5,
          },
          {
            id: "spices",
            href: "/blog",
            title: t("spiceStoryTitle"),
            excerpt: t("spiceStoryDescription"),
            image: "/images/home/persian-spices.webp",
            readTimeMinutes: 8,
          },
        ];

  return (
    <div className={styles.page}>
      <div className={styles.pageInner}>
        <HomeHero
          slides={content.hero}
          fallbackImage="/images/home/hero-grill.webp"
          fallbackImageAlt={t("heroImageAlt")}
          fallback={{
            eyebrow: t("heroBadge"),
            title: t("heroTitle"),
            description: t("heroDescription"),
            action: t("browseMenu"),
          }}
        />

        <section aria-label={t("banners")} className={styles.categoryPromos}>
          <PromoTile
            image={leadPromo?.image.url ?? "/images/home/ghormeh-sabzi.webp"}
            href={leadPromo?.link.href ?? mainCoursesHref}
            title={leadPromo?.title || t("traditionalStews")}
            wide
          />
          <div className={styles.promoPair}>
            <PromoTile image="/images/home/hero-grill.webp" href={kebabsHref} title={t("grills")} />
            <PromoTile image="/images/home/bastani-sonnati.webp" href="/menu" title={t("sweets")} />
          </div>
        </section>

        {featured.length > 0 && (
          <section
            aria-label={content.titles?.featured ?? t("featured")}
            className={styles.section}
          >
            <SectionHeading
              title={content.titles?.featured ?? t("featured")}
              href="/menu"
              action={t("viewAll")}
              icon={<StarRounded />}
            />
            <div className={styles.featuredRail}>
              {featured.map((dish) => (
                <FeaturedCard
                  key={dish.id}
                  dish={dish}
                  locale={locale}
                  saleLabel={t("salePercent")}
                  unavailableLabel={t("unavailable")}
                  viewDishLabel={t("viewDish")}
                />
              ))}
            </div>
          </section>
        )}

        {deals.length > 0 && (
          <section
            aria-label={content.titles?.discounted ?? t("discounted")}
            className={styles.section}
          >
            <SectionHeading
              title={content.titles?.discounted ?? t("discounted")}
              href="/menu"
              action={t("viewAll")}
              icon={<PercentRounded />}
            />
            <div className={styles.dealsRail}>
              {deals.map((dish) => (
                <DealCard
                  key={dish.id}
                  dish={dish}
                  locale={locale}
                  saleLabel={t("salePercent")}
                  unavailableLabel={t("unavailable")}
                />
              ))}
            </div>
          </section>
        )}

        {featured.length > 0 && (
          <section
            aria-label={t("bestSellers")}
            className={`${styles.section} ${styles.bestSellerSection}`}
          >
            <SectionHeading
              title={t("bestSellers")}
              href="/menu?sort=best_selling"
              action={t("viewAll")}
              icon={<LocalFireDepartmentRounded />}
            />
            <div className={styles.bestSellerList}>
              {featured.slice(0, 3).map((dish, index) => (
                <BestSellerRow key={dish.id} dish={dish} rank={index + 1} />
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="home-benefits-title" className={styles.benefitGrid}>
          {benefits.map((benefit) => (
            <article className={styles.benefitCard} key={benefit.id}>
              <span className={styles.benefitIcon} aria-hidden="true">
                {benefit.icon}
              </span>
              <h2 id={benefit.id === benefits[0]?.id ? "home-benefits-title" : undefined}>
                {benefit.title}
              </h2>
              <p>{benefit.description}</p>
            </article>
          ))}
        </section>

        {/* What our guests say is temporarily commented out as requested.
        <section className={styles.testimonials} aria-labelledby="home-testimonials-title">
          <h2 id="home-testimonials-title">{content.titles?.testimonials ?? t("testimonials")}</h2>
          {content.testimonials.map((item) => <blockquote key={item.id}>{item.quote}</blockquote>)}
        </section>
        */}

        <section aria-label={t("foodCulture")} className={styles.section}>
          <SectionHeading
            title={t("foodCulture")}
            href="/blog"
            action={t("viewAll")}
            icon={<ArticleRounded />}
          />
          <div className={styles.cultureRail}>
            {stories.map((story) => (
              <article className={styles.cultureCard} key={story.id}>
                <Link className={styles.cultureImageLink} href={story.href}>
                  <Box
                    alt=""
                    aria-hidden="true"
                    className={styles.cultureImage}
                    component="img"
                    loading="lazy"
                    src={story.image}
                  />
                  <span className={styles.readTime}>
                    {t("readTime", { count: story.readTimeMinutes })}
                  </span>
                </Link>
                <div className={styles.cultureCopy}>
                  <h3>
                    <Link href={story.href}>{story.title}</Link>
                  </h3>
                  <p>{story.excerpt}</p>
                  <Link className={styles.readPost} href={story.href}>
                    {t("readPost")}
                    <ArrowForwardRounded aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
