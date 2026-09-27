import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/locale";
import { getSitemap } from "@/lib/server-api";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await getSitemap().catch(() => ({ products: [], categories: [] }));
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/produits`, changeFrequency: "daily", priority: 0.8 },
    ...data.categories.map((category) => ({ url: `${SITE_URL}/categorie/${category.slug}`, lastModified: category.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...data.products.map((product) => ({ url: `${SITE_URL}/produits/${product.slug}`, lastModified: product.updatedAt, changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}
