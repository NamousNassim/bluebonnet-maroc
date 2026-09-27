import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { Dictionary, Locale, localized } from "@/lib/i18n";
import type { ProductSummary } from "@/lib/types";
import { AvailabilityLabel } from "./availability";
import styles from "./catalog.module.css";

export function ProductCard({ product, locale, t, priority = false }: { product: ProductSummary; locale: Locale; t: Dictionary; priority?: boolean }) {
  const name = localized(locale, product.nameFr, product.nameAr);
  const secondary = locale === "fr" ? product.nameAr : product.nameFr;
  return (
    <article className={styles.card}>
      <div className={styles.media}>
        {product.image && (
          <Image src={product.image.url} alt={localized(locale, product.image.altFr, product.image.altAr)} fill priority={priority}
            sizes="(max-width: 820px) 50vw, (max-width: 1100px) 33vw, 300px" unoptimized={product.image.url.endsWith(".svg")} />
        )}
        {product.isNew && <span className={styles.badge}>{t.newBadge}</span>}
      </div>
      <div className={styles.body}>
        <span className={styles.category}>{localized(locale, product.category.nameFr, product.category.nameAr)}</span>
        <Link href={`/produits/${product.slug}`} className={styles.name}>{name}</Link>
        {secondary && <span className={`${styles.nameAr} ${locale === "fr" ? "arabic" : ""}`}>{secondary}</span>}
        <div className={styles.priceRow}>
          <span className={styles.price}>
            {formatPrice(product.priceCents, locale)}
            {product.compareAtPriceCents && <span className={styles.compare}>{formatPrice(product.compareAtPriceCents, locale)}</span>}
          </span>
        </div>
        <AvailabilityLabel availability={product.availability} t={t} />
      </div>
    </article>
  );
}
