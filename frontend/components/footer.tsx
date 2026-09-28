import Link from "next/link";
import type { Category } from "@/lib/types";
import { Dictionary, Locale, localized } from "@/lib/i18n";
import { Monogram, Sprig } from "./brand";
import styles from "./footer.module.css";

export function Footer({ t, locale, categories }: { t: Dictionary; locale: Locale; categories: Category[] }) {
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));
  const universes = [
    { slug: "vaisselle", label: t.navDishware },
    { slug: "verrerie", label: t.navGlassware },
    { slug: "linge-de-table", label: t.navLinens },
    { slug: "accessoires", label: t.navAccessories },
  ];

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.grid}`}>
        <div className={styles.identity}>
          <Link href="/" className={styles.logo} aria-label="Bluebonnet, accueil">
            <Monogram size={84} />
            <span><strong>Bluebonnet</strong><small>{t.brandTagline}</small></span>
          </Link>
          <p>{t.footerAbout}</p>
        </div>
        <div>
          <h2>{t.footerUniverses}</h2>
          <ul>
            <li><Link href="/produits?sort=new">{t.navNew}</Link></li>
            <li><Link href="/produits">{t.navTableware}</Link></li>
            {universes.map(({ slug, label }) => {
              const category = categoryBySlug.get(slug);
              return <li key={slug}><Link href={`/categorie/${slug}`}>{category ? localized(locale, category.nameFr, category.nameAr) : label}</Link></li>;
            })}
          </ul>
        </div>
        <div>
          <h2>{t.footerAboutTitle}</h2>
          <ul>
            <li><Link href="/#story-title">{t.footerOurStory}</Link></li>
            <li><Link href="/#story-title">{t.footerOurWorld}</Link></li>
            <li><span>{t.footerCommitments}</span></li>
            <li><Link href="/#inspirations">{t.navInspiration}</Link></li>
          </ul>
        </div>
        <div>
          <h2>{t.footerHelp}</h2>
          <ul>
            <li><span>{t.footerDelivery}</span></li>
            <li><span>{t.footerReturns}</span></li>
            <li><span>{t.footerFaq}</span></li>
            <li><a href="mailto:contact@bluebonnetmaroc.com">{t.footerContact}</a></li>
          </ul>
        </div>
        <div className={styles.social}>
          <h2>{t.footerFollow}</h2>
          <a href="https://instagram.com/bluebonnetmaroc" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none" /></svg>
          </a>
          <div className={styles.footerSprig} aria-hidden="true"><Sprig height={150} /></div>
        </div>
      </div>
      <div className={`container ${styles.legal}`}>
        <span>© {new Date().getFullYear()} Bluebonnet Maroc · {t.footerRights}.</span>
        <div><span>{t.footerTerms}</span><span>{t.footerPrivacy}</span></div>
      </div>
    </footer>
  );
}
