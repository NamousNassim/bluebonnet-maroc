import type { Cart, Category, ProductDetail, ProductSummary } from "@/lib/types";

export const category: Category = { id: "c1", slug: "vaisselle", nameFr: "Vaisselle", nameAr: "الأواني", descriptionFr: "Assiettes et bols.", descriptionAr: null, imageUrl: "/images/categories/vaisselle.svg" };

export const product = (overrides: Partial<ProductSummary> = {}): ProductSummary => ({
  id: "p1", slug: "assiette-gres-artisanal", nameFr: "Assiette en grès artisanal", nameAr: "صحن من الخزف الحجري",
  shortDescriptionFr: "Grès émaillé.", shortDescriptionAr: null, priceCents: 24500, compareAtPriceCents: null,
  category: { slug: "vaisselle", nameFr: "Vaisselle", nameAr: "الأواني" },
  image: { url: "/images/products/vaisselle.svg", altFr: "Assiette", altAr: null }, isNew: true, availability: { state: "IN_STOCK" },
  ...overrides,
});

export const detail = (overrides: Partial<ProductDetail> = {}): ProductDetail => ({
  ...product(), sku: "BB-VAI-001", descriptionFr: "Une pièce Bluebonnet.", descriptionAr: null,
  images: [{ url: "/images/products/vaisselle.svg", altFr: "Assiette", altAr: null }, { url: "/images/products/vaisselle-detail.svg", altFr: "Détail", altAr: null }],
  seoTitle: null, seoDescription: null, updatedAt: "2026-09-27T00:00:00.000Z", ...overrides,
});

export const cart = (quantity = 2, overrides: Partial<Cart> = {}): Cart => ({
  items: [{ productId: "p1", slug: "assiette-gres-artisanal", nameFr: "Assiette en grès artisanal", nameAr: null, imageUrl: null, sku: "BB-VAI-001",
    unitPriceCents: 24500, quantity, lineTotalCents: 24500 * quantity, availability: { state: "IN_STOCK" }, unavailable: false }],
  itemCount: quantity, checkoutEnabled: true,
  totals: { subtotalCents: 24500 * quantity, shippingCents: 3000, totalCents: 24500 * quantity + 3000, freeShippingFromCents: 80000 },
  ...overrides,
});
