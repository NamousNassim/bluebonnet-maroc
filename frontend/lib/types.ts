/** Shapes returned by the Bluebonnet API (never by StartEntreprise directly). */
export interface Availability { state: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "UNKNOWN"; remaining?: number }
export interface Category { id: string; slug: string; nameFr: string; nameAr: string | null; descriptionFr: string | null; descriptionAr: string | null; imageUrl: string | null }
export interface Image { url: string; altFr: string; altAr: string | null }
export interface ProductSummary {
  id: string; slug: string; nameFr: string; nameAr: string | null; shortDescriptionFr: string | null; shortDescriptionAr: string | null;
  priceCents: number; compareAtPriceCents: number | null; category: { slug: string; nameFr: string; nameAr: string | null };
  image: Image | null; isNew: boolean; availability: Availability;
}
export interface ProductDetail extends ProductSummary {
  sku: string | null; descriptionFr: string | null; descriptionAr: string | null; images: Image[];
  seoTitle: string | null; seoDescription: string | null; updatedAt: string;
}
export interface ProductPage { items: ProductSummary[]; page: number; size: number; total: number; totalPages: number }
export interface Totals { subtotalCents: number; shippingCents: number; totalCents: number; freeShippingFromCents: number }
export interface CartLine {
  productId: string; slug: string; nameFr: string; nameAr: string | null; imageUrl: string | null; sku: string | null;
  unitPriceCents: number; quantity: number; lineTotalCents: number; availability: Availability; unavailable: boolean;
}
export interface Cart { items: CartLine[]; itemCount: number; totals: Totals; checkoutEnabled: boolean }
export interface OrderItem { productName: string; sku: string | null; unitPriceCents: number; quantity: number; lineTotalCents: number }
export interface Order { orderNumber: string; status: "PENDING" | "CANCELLED"; currency: string; subtotalCents: number; shippingCents: number; totalCents: number; createdAt: string; items: OrderItem[] }
export interface Checkout {
  id: string; reference: string; status: "CREATED" | "RESERVING" | "RESERVED" | "FAILED" | "EXPIRED" | "COMPLETED";
  subtotalCents: number; shippingCents: number; totalCents: number; reservationExpiresAt: string | null; failureCode: string | null; order: Order | null;
}
export interface ApiProblem { code: string; message: string; fields?: Record<string, string> }
export type ProductSort = "new" | "price_asc" | "price_desc" | "featured";
