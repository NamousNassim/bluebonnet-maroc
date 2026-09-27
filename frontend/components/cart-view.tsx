"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { removeCartLine, StorefrontError, updateCartLine } from "@/lib/client-api";
import { formatPrice } from "@/lib/format";
import { dictionaries, Locale, localized } from "@/lib/i18n";
import type { Cart } from "@/lib/types";
import { AvailabilityLabel } from "./availability";
import styles from "./commerce.module.css";

/** Every total shown here comes back from the API after each change; nothing is computed locally. */
export function CartView({ initial, locale }: { initial: Cart; locale: Locale }) {
  const t = dictionaries[locale];
  const [cart, setCart] = useState(initial);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  async function run(productId: string, action: () => Promise<Cart>) {
    setBusy(productId); setError(undefined);
    try { setCart(await action()); } catch (failure) {
      setError(failure instanceof StorefrontError ? failure.problem.message : t.genericError);
    } finally { setBusy(undefined); }
  }

  if (!cart.items.length) {
    return (
      <div className={styles.empty}>
        <p>{t.cartEmpty}</p>
        <Link className="button" href="/produits">{t.continueShopping}</Link>
      </div>
    );
  }
  const blocked = !cart.checkoutEnabled || cart.items.some((item) => item.unavailable);
  return (
    <div className={styles.cartLayout}>
      <div className={styles.lines}>
        {error && <p className="notice notice-error" role="alert">{error}</p>}
        {cart.items.map((item) => (
          <article key={item.productId} className={`${styles.line} ${item.unavailable ? styles.unavailableLine : ""}`} aria-busy={busy === item.productId}>
            <div className={styles.lineImage}>
              {item.imageUrl && <Image src={item.imageUrl} alt="" fill sizes="96px" unoptimized={item.imageUrl.endsWith(".svg")} />}
            </div>
            <div className={styles.lineInfo}>
              <Link href={`/produits/${item.slug}`}>{localized(locale, item.nameFr, item.nameAr)}</Link>
              <span className="hint">{formatPrice(item.unitPriceCents, locale)}</span>
              {item.unavailable ? <span className="field-error">{t.unavailableLine}</span> : <AvailabilityLabel availability={item.availability} t={t} />}
            </div>
            <div className={styles.lineActions}>
              <div className={styles.stepper} role="group" aria-label={`${t.quantity} — ${item.nameFr}`}>
                <button type="button" aria-label="−1" disabled={!!busy || item.quantity <= 1 || item.unavailable}
                  onClick={() => void run(item.productId, () => updateCartLine(item.productId, item.quantity - 1))}>−</button>
                <output>{item.quantity}</output>
                <button type="button" aria-label="+1" disabled={!!busy || item.quantity >= 99 || item.unavailable}
                  onClick={() => void run(item.productId, () => updateCartLine(item.productId, item.quantity + 1))}>+</button>
              </div>
              <span className={styles.lineTotal}>{formatPrice(item.lineTotalCents, locale)}</span>
              <button type="button" className={styles.link} disabled={!!busy} onClick={() => void run(item.productId, () => removeCartLine(item.productId))}>{t.remove}</button>
            </div>
          </article>
        ))}
      </div>
      <aside className={styles.summary} aria-label={t.orderSummary}>
        <h2>{t.orderSummary}</h2>
        <div className={styles.row}><span>{t.subtotal}</span><span>{formatPrice(cart.totals.subtotalCents, locale)}</span></div>
        <div className={styles.row}><span>{t.shipping}</span><span>{cart.totals.shippingCents ? formatPrice(cart.totals.shippingCents, locale) : t.shippingFree}</span></div>
        <div className={`${styles.row} ${styles.totalRow}`}><span>{t.total}</span><span>{formatPrice(cart.totals.totalCents, locale)}</span></div>
        {cart.totals.shippingCents > 0 && cart.totals.freeShippingFromCents > 0 && <p className={styles.hint}>{t.freeShippingHint(formatPrice(cart.totals.freeShippingFromCents, locale))}</p>}
        {!cart.checkoutEnabled && <p className={styles.hint} role="note">{t.checkoutClosed}</p>}
        {blocked ? <button className="button" type="button" disabled>{t.checkout}</button> : <Link className="button" href="/checkout">{t.checkout} <span className="arrow" aria-hidden="true">→</span></Link>}
      </aside>
    </div>
  );
}
