import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/add-to-cart";
import { AvailabilityLabel } from "@/components/availability";
import styles from "@/components/commerce.module.css";
import { ProductGallery } from "@/components/product-gallery";
import { formatPrice } from "@/lib/format";
import { localized } from "@/lib/i18n";
import { getDictionary } from "@/lib/locale";
import { breadcrumbJsonLd, jsonLd, productJsonLd } from "@/lib/seo";
import { ApiError, getProduct } from "@/lib/server-api";

type Params = Promise<{ slug: string }>;

async function load(slug: string) {
  try { return await getProduct(slug); } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const product = await load((await params).slug);
  const title = product.seoTitle ?? product.nameFr;
  const description = product.seoDescription ?? product.shortDescriptionFr ?? `${product.nameFr} — Bluebonnet, arts de la table et maison.`;
  const url = `/produits/${product.slug}`;
  return {
    title, description, alternates: { canonical: url },
    openGraph: { title: `${title} | Bluebonnet`, description, url, type: "website", images: product.images.slice(0, 1).map((image) => ({ url: image.url, alt: image.altFr })) },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const product = await load((await params).slug);
  const { locale, t } = await getDictionary();
  const name = localized(locale, product.nameFr, product.nameAr);
  const categoryName = localized(locale, product.category.nameFr, product.category.nameAr);
  const description = localized(locale, product.descriptionFr ?? "", product.descriptionAr);
  const shortDescription = localized(locale, product.shortDescriptionFr ?? "", product.shortDescriptionAr);
  return (
    <div className="container" style={{ paddingBottom: "clamp(40px, 7vw, 88px)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(productJsonLd(product))} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbJsonLd([
        { name: "Accueil", path: "/" }, { name: product.category.nameFr, path: `/categorie/${product.category.slug}` },
        { name: product.nameFr, path: `/produits/${product.slug}` },
      ]))} />
      <nav className="breadcrumb" aria-label="Breadcrumb" style={{ paddingTop: 24 }}>
        <Link href="/">{t.home}</Link><span aria-hidden="true">/</span>
        <Link href={`/categorie/${product.category.slug}`}>{categoryName}</Link><span aria-hidden="true">/</span>
        <span aria-current="page">{name}</span>
      </nav>
      <div className={styles.product}>
        <ProductGallery images={product.images} altFr={product.nameFr} locale={locale} />
        <div className={styles.info}>
          <span className="eyebrow">{categoryName}</span>
          <h1>{name}</h1>
          {shortDescription && <p className={styles.subtitle} dir="auto">{shortDescription}</p>}
          <p className={styles.price}>
            {formatPrice(product.priceCents, locale)}
            {product.compareAtPriceCents && <span className={styles.compare}>{formatPrice(product.compareAtPriceCents, locale)}</span>}
          </p>
          <AvailabilityLabel availability={product.availability} t={t} />
          <AddToCart productId={product.id} disabled={product.availability.state === "OUT_OF_STOCK"} locale={locale} />
          {description && (
            <section aria-labelledby="description-title">
              <h2 id="description-title" style={{ fontSize: "1.2rem", marginBottom: 8 }}>{t.description}</h2>
              <p className={styles.description} dir="auto">{description}</p>
            </section>
          )}
          {product.sku && <p className={styles.meta}>{t.sku} : {product.sku}</p>}
        </div>
      </div>
    </div>
  );
}
