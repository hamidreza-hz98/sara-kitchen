export type HomeImage = Readonly<{ url: string; alt: string }>;
export type HomeLink = Readonly<{ href: string; newTab: boolean }>;
export type HomeDish = Readonly<{
  id: string;
  slug: string;
  name: string;
  excerpt: string;
  image: HomeImage | null;
  priceCents: number;
  originalPriceCents: number | null;
}>;
export type HomeContent = Readonly<{
  hero: readonly Readonly<{
    id: string;
    title: string;
    description: string;
    ctaLabel: string;
    image: HomeImage;
    mobileImage: HomeImage | null;
    link: HomeLink | null;
  }>[];
  banners: readonly Readonly<{ id: string; title: string; image: HomeImage; link: HomeLink }>[];
  featured: readonly HomeDish[];
  benefits: readonly Readonly<{
    id: string;
    title: string;
    description: string;
    icon: HomeImage | null;
  }>[];
  discounted: readonly HomeDish[];
  categories: readonly Readonly<{
    id: string;
    slug: string;
    name: string;
    image: HomeImage | null;
  }>[];
  testimonials: readonly Readonly<{
    id: string;
    author: string;
    role: string;
    quote: string;
    rating: number;
    avatar: HomeImage | null;
  }>[];
  blogs: readonly Readonly<{
    id: string;
    slug: string;
    title: string;
    excerpt: string;
    image: HomeImage | null;
    readTimeMinutes: number;
  }>[];
  titles: Readonly<{
    featured: string;
    benefits: string;
    discounted: string;
    categories: string;
    testimonials: string;
    blog: string;
  }> | null;
}>;

export const EMPTY_HOME_CONTENT: HomeContent = {
  hero: [],
  banners: [],
  featured: [],
  benefits: [],
  discounted: [],
  categories: [],
  testimonials: [],
  blogs: [],
  titles: null,
};
