import type { Availability } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n";
import styles from "./catalog.module.css";

/** Coarse, customer-facing availability; the exact stock is never shown. */
export function AvailabilityLabel({ availability, t }: { availability: Availability; t: Dictionary }) {
  switch (availability.state) {
    case "IN_STOCK": return <span className={styles.availability}>{t.inStock}</span>;
    case "LOW_STOCK": return <span className={`${styles.availability} ${styles.low}`}>{t.lowStock(availability.remaining ?? 1)}</span>;
    case "OUT_OF_STOCK": return <span className={`${styles.availability} ${styles.out}`}>{t.outOfStock}</span>;
    default: return <span className={`${styles.availability} ${styles.unknown}`}>{t.unknownStock}</span>;
  }
}
