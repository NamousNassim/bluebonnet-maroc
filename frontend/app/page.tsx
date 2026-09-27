import Link from "next/link";
import { Diamond, Sprig } from "@/components/brand";
import { CategoryCard } from "@/components/category-card";
import { ProductCard } from "@/components/product-card";
import catalog from "@/components/catalog.module.css";
import { getDictionary } from "@/lib/locale";
import { getCategories, getProducts } from "@/lib/server-api";
import styles from "./home.module.css";

export default async function HomePage() {
  const { locale, t } = await getDictionary();
  const [categories, featured] = await Promise.all([
    getCategories().catch(() => []),
    getProducts({ featured: true, size: 4, sort: "featured" }).then((page) => page.items).catch(() => []),
  ]);
  return (
    <>
      <section className={styles.hero}>
        <div className={`container ${styles.heroInner}`}>
          <div className={styles.heroText}>
            <span className="eyebrow">{t.heroEyebrow}</span>
            <h1>{t.heroTitle}</h1>
            <p>{t.brandTagline}.</p>
            <Link className="button" href="/produits">{t.heroCta} <span className="arrow" aria-hidden="true">→</span></Link>
          </div>
          <div className={styles.heroArt} aria-hidden="true"><Sprig height={320} /></div>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="section container" aria-labelledby="categories-title">
          <div className="section-head"><h2 id="categories-title">{t.categoriesTitle}</h2></div>
          <div className={styles.categories}>
            {categories.map((category) => <CategoryCard key={category.slug} category={category} />)}
          </div>
        </section>
      )}

      {featured.length > 0 && (
        <section className="section container" aria-labelledby="featured-title">
          <div className="section-head">
            <h2 id="featured-title">{t.featuredTitle}</h2>
            <Link href="/produits">{t.seeAll}</Link>
          </div>
          <div className={catalog.grid}>
            {featured.map((product, index) => <ProductCard key={product.id} product={product} locale={locale} t={t} priority={index < 2} />)}
          </div>
        </section>
      )}

      <section id="inspirations" className={`section ${styles.story}`} aria-labelledby="story-title">
        <div className={`container ${styles.storyInner}`}>
          <div className={styles.storyMark} aria-hidden="true"><Sprig height={200} /></div>
          <div>
            <span className="eyebrow">{t.storyEyebrow}</span>
            <h2 id="story-title">{t.storyTitle}</h2>
            <p>{t.storyText}</p>
          </div>
        </div>
      </section>

      <section className="section container">
        <div className={styles.editorial}>
          <article className={styles.editorialCard}>
            <h3 lang="en">{t.editorialTitle}</h3>
            <p>{t.editorialText}</p>
            <Link className="button button-outline" href="/categorie/vaisselle">{t.navTableware}</Link>
          </article>
          <article className={styles.editorialCard}>
            <h3>{t.navDecor}</h3>
            <p>{t.storyTitle}.</p>
            <Link className="button button-outline" href="/categorie/decoration">{t.seeAll}</Link>
          </article>
        </div>
      </section>

      <section className="section container" aria-labelledby="newsletter-title">
        <div className={styles.newsletter}>
          <Diamond />
          <h2 id="newsletter-title">{t.newsletterTitle}</h2>
          <p>{t.newsletterText}</p>
        </div>
      </section>
    </>
  );
}
