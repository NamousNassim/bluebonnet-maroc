import Link from "next/link";
import type { Category } from "@/lib/types";
import { Dictionary, Locale, localized } from "@/lib/i18n";
import styles from "./footer.module.css";

export function Footer({ t, locale, categories }: { t: Dictionary; locale: Locale; categories: Category[] }) {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.grid}`}>
        <div>
          <h2>Bluebonnet</h2>
          <p>{t.footerAbout}</p>
          <p lang="ar" className="arabic">جمال في تفاصيل كل يوم.</p>
        </div>
        <div>
          <h3>{t.products}</h3>
          <ul>
            {categories.map((category) => (
              <li key={category.slug}><Link href={`/categorie/${category.slug}`}>{localized(locale, category.nameFr, category.nameAr)}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Contact</h3>
          <ul>
            <li><a href="mailto:contact@bluebonnetmaroc.com">contact@bluebonnetmaroc.com</a></li>
            <li><a href="https://instagram.com/bluebonnetmaroc" target="_blank" rel="noopener noreferrer">Instagram</a></li>
          </ul>
        </div>
      </div>
      <div className={`container ${styles.legal}`}>
        <span>© {new Date().getFullYear()} Bluebonnet Maroc · {t.footerRights}</span>
        <span>{t.heroEyebrow}</span>
      </div>
    </footer>
  );
}
