import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Listing, parsePage, parseSort } from "@/components/listing";
import { localized } from "@/lib/i18n";
import { getDictionary } from "@/lib/locale";
import { breadcrumbJsonLd, jsonLd } from "@/lib/seo";
import { ApiError, getCategories, getCategory, getProducts } from "@/lib/server-api";

type Params = Promise<{ slug: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

async function load(slug: string) {
  try { return await getCategory(slug); } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const category = await load((await params).slug);
  const description = category.descriptionFr ?? `${category.nameFr} Bluebonnet : pièces choisies pour la table et la maison.`;
  return {
    title: category.nameFr, description,
    alternates: { canonical: `/categorie/${category.slug}` },
    openGraph: { title: `${category.nameFr} | Bluebonnet`, description, url: `/categorie/${category.slug}`, images: category.imageUrl ? [category.imageUrl] : undefined },
  };
}

export default async function CategoryPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { slug } = await params;
  const query = await searchParams;
  const { locale, t } = await getDictionary();
  const category = await load(slug);
  const search = typeof query.q === "string" ? query.q.trim().slice(0, 100) || undefined : undefined;
  const sort = parseSort(query.sort);
  const [data, categories] = await Promise.all([
    getProducts({ category: slug, page: parsePage(query.page), size: 12, search, sort }),
    getCategories().catch(() => []),
  ]);
  const name = localized(locale, category.nameFr, category.nameAr);
  return (
    <div className="container">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbJsonLd([
        { name: "Accueil", path: "/" }, { name: "Produits", path: "/produits" }, { name: category.nameFr, path: `/categorie/${category.slug}` },
      ]))} />
      <header className="page-head">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/">{t.home}</Link><span aria-hidden="true">/</span>
          <Link href="/produits">{t.products}</Link><span aria-hidden="true">/</span>
          <span aria-current="page">{name}</span>
        </nav>
        <h1>{name}</h1>
        {category.descriptionFr && <p>{localized(locale, category.descriptionFr, category.descriptionAr)}</p>}
      </header>
      <Listing data={data} categories={categories} activeCategory={slug} basePath={`/categorie/${slug}`} search={search} sort={sort} locale={locale} t={t} />
    </div>
  );
}
