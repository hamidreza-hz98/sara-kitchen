import type { RichTextDocument } from "@/lib/rich-text";

export type DishDetailImage = Readonly<{ url: string; alt: string }>;
export type DishDetailRelated = Readonly<{
  slug: string;
  name: string;
  excerpt: string;
  image: DishDetailImage | null;
  priceCents: number;
}>;
export type DishDetailBlog = Readonly<{
  slug: string;
  title: string;
  excerpt: string;
  image: DishDetailImage | null;
  readTimeMinutes: number;
}>;
export type DishDetailContent = Readonly<{
  id: string;
  slug: string;
  name: string;
  excerpt: string;
  description: RichTextDocument | null;
  images: readonly DishDetailImage[];
  category: Readonly<{ slug: string; name: string }> | null;
  priceCents: number;
  basePriceCents: number;
  discount: Readonly<{ amountCents: number; percentage: number | null }> | null;
  isOrderable: boolean;
  leadTimeMinutes: number;
  maxQuantity: number;
  portion: Readonly<{ amount: number; unit: string }>;
  ingredients: readonly Readonly<{
    name: string;
    note: string;
    image: DishDetailImage | null;
    quantityAmount: number | null;
    quantityUnit: string | null;
  }>[];
  allergens: Readonly<{ contains: readonly string[]; mayContain: readonly string[] }>;
  dietaryTags: readonly string[];
  specifications: readonly Readonly<{ label: string; value: string }>[];
  relatedDishes: readonly DishDetailRelated[];
  relatedBlogs: readonly DishDetailBlog[];
}>;
