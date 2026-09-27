import Link from "next/link";
import { Dictionary, Locale, localized } from "@/lib/i18n";
import type { Category, ProductPage, ProductSort } from "@/lib/types";
import { ProductCard } from "./product-card";
import styles from "./catalog.module.css";

/**
 * Product listing shared by /produits and /categorie/[slug]. Search and sort are a plain GET form and
 * category filters are links: pagination and filtering happen on the server, with no client JS.
 */
export function Listing({ data, categories, activeCategory, basePath, search, sort, locale, t }: {
  data: ProductPage; categories: Category[]; activeCategory?: string; basePath: string; search?: string; sort: ProductSort;
  locale: Locale; t: Dictionary;
}) {
  const href = (page: number) => {
    const parameters = new URLSearchParams();
    if (search) parameters.set("q", search);
    if (sort !== "new") parameters.set("sort", sort);
    if (page > 1) parameters.set("page", String(page));
    const query = parameters.toString();
    return `${basePath}${query ? `?${query}` : ""}`;
  };
  return (
    <>
      <div className={styles.toolbar}>
        <nav className={styles.pills} aria-label={t.products}>
          <Link className={styles.pill} href="/produits" aria-current={!activeCategory ? "page" : undefined}>{t.filterAll}</Link>
          {categories.map((category) => (
            <Link key={category.slug} className={styles.pill} href={`/categorie/${category.slug}`} aria-current={activeCategory === category.slug ? "page" : undefined}>
              {localized(locale, category.nameFr, category.nameAr)}
            </Link>
          ))}
        </nav>
        <form className={styles.controls} action={basePath} role="search">
          <label className="sr-only" htmlFor="listing-search">{t.search}</label>
          <input id="listing-search" type="search" name="q" defaultValue={search} placeholder={t.searchPlaceholder} />
          <label className="sr-only" htmlFor="listing-sort">{t.sortLabel}</label>
          <select id="listing-sort" name="sort" defaultValue={sort}>
            <option value="new">{t.sortNew}</option>
            <option value="price_asc">{t.sortPriceAsc}</option>
            <option value="price_desc">{t.sortPriceDesc}</option>
          </select>
          <button className="button button-outline" type="submit">{t.search}</button>
        </form>
      </div>
      <p className={styles.count} role="status">{t.resultCount(data.total)}</p>
      {data.items.length ? (
        <div className={styles.grid}>
          {data.items.map((product, index) => <ProductCard key={product.id} product={product} locale={locale} t={t} priority={index < 4} />)}
        </div>
      ) : <p className={styles.empty}>{t.noResults}</p>}
      {data.totalPages > 1 && (
        <nav className={styles.pagination} aria-label="Pagination">
          {data.page > 1 && <Link href={href(data.page - 1)} rel="prev">{t.previous}</Link>}
          <span>{t.pageOf(data.page, data.totalPages)}</span>
          {data.page < data.totalPages && <Link href={href(data.page + 1)} rel="next">{t.next}</Link>}
        </nav>
      )}
    </>
  );
}

export function parseSort(value: string | string[] | undefined): ProductSort {
  return value === "price_asc" || value === "price_desc" ? value : "new";
}

export function parsePage(value: string | string[] | undefined): number {
  const page = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}
