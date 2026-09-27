import Image from "next/image";
import Link from "next/link";
import type { Category } from "@/lib/types";
import styles from "./catalog.module.css";

/** Arched card from the charter: French name with its Arabic counterpart. */
export function CategoryCard({ category }: { category: Category }) {
  return (
    <Link href={`/categorie/${category.slug}`} className={styles.categoryCard}>
      <div className={styles.arch}>
        {category.imageUrl && <Image src={category.imageUrl} alt="" fill sizes="(max-width: 620px) 50vw, 240px" unoptimized={category.imageUrl.endsWith(".svg")} />}
      </div>
      <div className={styles.categoryLabel}>
        <div>
          <strong>{category.nameFr}</strong>
          {category.nameAr && <span className="arabic" lang="ar">{category.nameAr}</span>}
        </div>
        <span className={`${styles.arrow} arrow`} aria-hidden="true">→</span>
      </div>
    </Link>
  );
}
