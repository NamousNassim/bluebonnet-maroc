import { Injectable } from "@nestjs/common";
import { z } from "zod";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { StorefrontError } from "../common/storefront-error";
import { AvailabilityService, DisplayAvailability } from "./availability.service";

export const productQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(48).default(24),
  category: z.string().max(120).optional(),
  search: z.string().trim().max(100).optional(),
  sort: z.enum(["new", "price_asc", "price_desc", "featured"]).default("new"),
  featured: z.enum(["true", "false"]).optional(),
});
export type ProductQuery = z.infer<typeof productQuerySchema>;

export interface CategoryView { id: string; slug: string; nameFr: string; nameAr: string | null; descriptionFr: string | null; descriptionAr: string | null; imageUrl: string | null }
export interface ImageView { url: string; altFr: string; altAr: string | null }
export interface ProductSummary {
  id: string; slug: string; nameFr: string; nameAr: string | null; shortDescriptionFr: string | null; shortDescriptionAr: string | null;
  priceCents: number; compareAtPriceCents: number | null; category: { slug: string; nameFr: string; nameAr: string | null };
  image: ImageView | null; isNew: boolean; availability: DisplayAvailability;
}
export interface ProductDetail extends ProductSummary {
  sku: string | null; descriptionFr: string | null; descriptionAr: string | null; images: ImageView[];
  seoTitle: string | null; seoDescription: string | null; updatedAt: string;
}

const NEW_FOR_DAYS = 30;
const productInclude = { category: true, images: { orderBy: { position: "asc" as const } } } satisfies Prisma.ProductInclude;
type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

/** Storefront catalogue: only published, active products in active categories are ever visible. */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService, private readonly availability: AvailabilityService) {}

  async categories(): Promise<CategoryView[]> {
    const rows = await this.prisma.category.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { nameFr: "asc" }] });
    return rows.map(categoryView);
  }

  async category(slug: string): Promise<CategoryView> {
    const row = await this.prisma.category.findFirst({ where: { slug, active: true } });
    if (!row) throw StorefrontError.notFound("CATEGORY_NOT_FOUND", "Catégorie introuvable.");
    return categoryView(row);
  }

  async products(query: ProductQuery, requestId?: string) {
    const where: Prisma.ProductWhereInput = { ...visible(), ...(query.featured === "true" ? { featured: true } : {}) };
    if (query.category) where.category = { slug: query.category, active: true };
    if (query.search) {
      where.OR = [
        { nameFr: { contains: query.search, mode: "insensitive" } },
        { nameAr: { contains: query.search, mode: "insensitive" } },
        { sku: { equals: query.search, mode: "insensitive" } },
      ];
    }
    const orderBy: Prisma.ProductOrderByWithRelationInput[] = query.sort === "price_asc" ? [{ priceCents: "asc" }, { id: "asc" }]
      : query.sort === "price_desc" ? [{ priceCents: "desc" }, { id: "asc" }]
      : query.sort === "featured" ? [{ sortOrder: "asc" }, { publishedAt: "desc" }, { id: "asc" }]
      : [{ publishedAt: "desc" }, { id: "asc" }];
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({ where, orderBy, include: productInclude, skip: (query.page - 1) * query.size, take: query.size }),
    ]);
    const availability = await this.availability.forCatalogueIds(rows.map((row) => row.startEntrepriseCatalogueId), requestId);
    return {
      items: rows.map((row) => summary(row, availability.get(row.startEntrepriseCatalogueId))),
      page: query.page, size: query.size, total, totalPages: Math.ceil(total / query.size),
    };
  }

  async product(slug: string, requestId?: string): Promise<ProductDetail> {
    const row = await this.prisma.product.findFirst({ where: { slug, ...visible() }, include: productInclude });
    if (!row) throw StorefrontError.notFound("PRODUCT_NOT_FOUND", "Produit introuvable.");
    const availability = await this.availability.forCatalogueIds([row.startEntrepriseCatalogueId], requestId);
    return {
      ...summary(row, availability.get(row.startEntrepriseCatalogueId)),
      sku: row.sku, descriptionFr: row.descriptionFr, descriptionAr: row.descriptionAr,
      images: row.images.map(imageView), seoTitle: row.seoTitleFr, seoDescription: row.seoDescriptionFr, updatedAt: row.updatedAt.toISOString(),
    };
  }

  /** Bounded list for the sitemap. */
  async sitemap() {
    const [products, categories] = await Promise.all([
      this.prisma.product.findMany({ where: visible(), select: { slug: true, updatedAt: true }, orderBy: { publishedAt: "desc" }, take: 5000 }),
      this.prisma.category.findMany({ where: { active: true }, select: { slug: true, updatedAt: true } }),
    ]);
    return { products: products.map((row) => ({ slug: row.slug, updatedAt: row.updatedAt.toISOString() })),
      categories: categories.map((row) => ({ slug: row.slug, updatedAt: row.updatedAt.toISOString() })) };
  }
}

export function visible(): Prisma.ProductWhereInput {
  return { published: true, active: true, category: { active: true } };
}

function categoryView(row: { id: string; slug: string; nameFr: string; nameAr: string | null; descriptionFr: string | null; descriptionAr: string | null; imageUrl: string | null }): CategoryView {
  return { id: row.id, slug: row.slug, nameFr: row.nameFr, nameAr: row.nameAr, descriptionFr: row.descriptionFr, descriptionAr: row.descriptionAr, imageUrl: row.imageUrl };
}

function imageView(row: { url: string; altFr: string; altAr: string | null }): ImageView {
  return { url: row.url, altFr: row.altFr, altAr: row.altAr };
}

function summary(row: ProductRow, availability: DisplayAvailability | undefined): ProductSummary {
  const publishedAt = row.publishedAt?.getTime() ?? 0;
  return {
    id: row.id, slug: row.slug, nameFr: row.nameFr, nameAr: row.nameAr,
    shortDescriptionFr: row.shortDescriptionFr, shortDescriptionAr: row.shortDescriptionAr,
    priceCents: row.priceCents, compareAtPriceCents: row.compareAtPriceCents,
    category: { slug: row.category.slug, nameFr: row.category.nameFr, nameAr: row.category.nameAr },
    image: row.images[0] ? imageView(row.images[0]) : null,
    isNew: publishedAt > Date.now() - NEW_FOR_DAYS * 86_400_000,
    availability: availability ?? { state: "UNKNOWN" },
  };
}
