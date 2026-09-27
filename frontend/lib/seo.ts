import { SITE_URL } from "./locale";
import type { ProductDetail } from "./types";

/** Serialises JSON-LD safely inside a <script> tag (no "</script>" breakout). */
export function jsonLd(data: unknown): { __html: string } {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}

const absolute = (path: string) => (path.startsWith("http") ? path : `${SITE_URL}${path}`);

export function productJsonLd(product: ProductDetail) {
  const availability = {
    IN_STOCK: "https://schema.org/InStock", LOW_STOCK: "https://schema.org/LimitedAvailability",
    OUT_OF_STOCK: "https://schema.org/OutOfStock", UNKNOWN: undefined,
  }[product.availability.state];
  return {
    "@context": "https://schema.org", "@type": "Product",
    name: product.nameFr, description: product.shortDescriptionFr ?? product.descriptionFr ?? undefined,
    sku: product.sku ?? undefined, image: product.images.map((image) => absolute(image.url)),
    brand: { "@type": "Brand", name: "Bluebonnet" },
    category: product.category.nameFr,
    offers: {
      "@type": "Offer", url: `${SITE_URL}/produits/${product.slug}`, priceCurrency: "MAD",
      price: (product.priceCents / 100).toFixed(2), ...(availability ? { availability } : {}), itemCondition: "https://schema.org/NewCondition",
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: absolute(item.path) })),
  };
}
