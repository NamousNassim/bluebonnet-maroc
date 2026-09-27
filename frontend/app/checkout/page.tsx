import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/checkout-form";
import styles from "@/components/commerce.module.css";
import { formatPrice } from "@/lib/format";
import { localized } from "@/lib/i18n";
import { getDictionary } from "@/lib/locale";
import { getCart } from "@/lib/server-api";

export const metadata: Metadata = { title: "Commande", robots: { index: false, follow: false } };

export default async function CheckoutPage() {
  const { locale, t } = await getDictionary();
  const cart = await getCart();
  if (!cart.items.length) redirect("/panier");
  return (
    <div className="container" style={{ paddingBottom: "clamp(40px, 7vw, 88px)" }}>
      <header className="page-head"><h1>{t.checkoutTitle}</h1></header>
      <div className={styles.cartLayout}>
        <CheckoutForm locale={locale} enabled={cart.checkoutEnabled} />
        <aside className={styles.summary} aria-label={t.orderSummary}>
          <h2>{t.orderSummary}</h2>
          {cart.items.map((item) => (
            <div key={item.productId} className={styles.row}>
              <span>{localized(locale, item.nameFr, item.nameAr)} × {item.quantity}</span>
              <span>{formatPrice(item.lineTotalCents, locale)}</span>
            </div>
          ))}
          <div className={styles.row}><span>{t.subtotal}</span><span>{formatPrice(cart.totals.subtotalCents, locale)}</span></div>
          <div className={styles.row}><span>{t.shipping}</span><span>{cart.totals.shippingCents ? formatPrice(cart.totals.shippingCents, locale) : t.shippingFree}</span></div>
          <div className={`${styles.row} ${styles.totalRow}`}><span>{t.total}</span><span>{formatPrice(cart.totals.totalCents, locale)}</span></div>
        </aside>
      </div>
    </div>
  );
}
