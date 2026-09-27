import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "@/components/commerce.module.css";
import { formatPrice } from "@/lib/format";
import { getDictionary } from "@/lib/locale";
import { ApiError, getCheckout } from "@/lib/server-api";

export const metadata: Metadata = { title: "Commande", robots: { index: false, follow: false } };

/** Only visible from the browser holding the cart that placed the order (the API checks the cart cookie). */
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { locale, t } = await getDictionary();
  const checkout = await getCheckout(id).catch((error) => {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  });
  const order = checkout.order;
  if (!order) notFound();
  const cancelled = order.status === "CANCELLED";
  return (
    <div className="container" style={{ paddingBottom: "clamp(40px, 7vw, 88px)", maxWidth: 760 }}>
      <header className="page-head">
        <span className="eyebrow">{t.orderNumber} · {order.orderNumber}</span>
        <h1>{cancelled ? t.orderExpired : t.orderConfirmed}</h1>
        <p>{cancelled ? t.orderExpiredNote : t.orderPendingNote}</p>
      </header>
      <section className={styles.summary} style={{ position: "static" }} aria-label={t.orderSummary}>
        <h2>{t.orderSummary}</h2>
        {order.items.map((item, index) => (
          <div key={index} className={styles.row}>
            <span>{item.productName} × {item.quantity}</span>
            <span>{formatPrice(item.lineTotalCents, locale)}</span>
          </div>
        ))}
        <div className={styles.row}><span>{t.subtotal}</span><span>{formatPrice(order.subtotalCents, locale)}</span></div>
        <div className={styles.row}><span>{t.shipping}</span><span>{order.shippingCents ? formatPrice(order.shippingCents, locale) : t.shippingFree}</span></div>
        <div className={`${styles.row} ${styles.totalRow}`}><span>{t.total}</span><span>{formatPrice(order.totalCents, locale)}</span></div>
      </section>
      <p style={{ marginTop: 24 }}><Link className="button button-outline" href="/produits">{t.continueShopping}</Link></p>
    </div>
  );
}
