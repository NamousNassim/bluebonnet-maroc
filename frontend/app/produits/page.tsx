import type { Metadata } from "next";
import { Listing, parsePage, parseSort } from "@/components/listing";
import { getDictionary } from "@/lib/locale";
import { getCategories, getProducts } from "@/lib/server-api";

type Search = Promise<Record<string, string | string[] | undefined>>;
const text = (value: string | string[] | undefined) => (typeof value === "string" ? value.trim().slice(0, 100) : undefined) || undefined;

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const query = await searchParams;
  // Search and sort variants are not indexed separately; the canonical is the plain listing.
  return {
    title: "Tous les produits",
    description: "Vaisselle, verrerie, linge de table, décoration et accessoires Bluebonnet.",
    alternates: { canonical: "/produits" },
    robots: text(query.q) ? { index: false, follow: true } : undefined,
    openGraph: { title: "Tous les produits | Bluebonnet", url: "/produits" },
  };
}

export default async function ProductsPage({ searchParams }: { searchParams: Search }) {
  const query = await searchParams;
  const { locale, t } = await getDictionary();
  const search = text(query.q);
  const sort = parseSort(query.sort);
  const [data, categories] = await Promise.all([
    getProducts({ page: parsePage(query.page), size: 12, search, sort }),
    getCategories().catch(() => []),
  ]);
  return (
    <div className="container">
      <header className="page-head">
        <h1>{t.allProducts}</h1>
      </header>
      <Listing data={data} categories={categories} basePath="/produits" search={search} sort={sort} locale={locale} t={t} />
    </div>
  );
}
