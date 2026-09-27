"use client";

import Link from "next/link";
import { useState } from "react";
import { addToCart, StorefrontError } from "@/lib/client-api";
import { dictionaries, type Locale } from "@/lib/i18n";
import styles from "./commerce.module.css";

const MAX = 99;

/** Adds to the cart only; stock is reserved later, at checkout confirmation. */
export function AddToCart({ productId, disabled, locale }: { productId: string; disabled: boolean; locale: Locale }) {
  const t = dictionaries[locale];
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string }>();

  async function submit() {
    setBusy(true); setMessage(undefined);
    try {
      await addToCart(productId, quantity);
      setMessage({ tone: "ok", text: t.added });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof StorefrontError ? error.problem.message : t.genericError });
    } finally { setBusy(false); }
  }

  return (
    <div className={styles.buy}>
      <div className={styles.stepper} role="group" aria-label={t.quantity}>
        <button type="button" aria-label="−1" disabled={quantity <= 1} onClick={() => setQuantity((value) => value - 1)}>−</button>
        <output aria-live="polite">{quantity}</output>
        <button type="button" aria-label="+1" disabled={quantity >= MAX} onClick={() => setQuantity((value) => value + 1)}>+</button>
      </div>
      <button type="button" className="button" disabled={busy || disabled} onClick={() => void submit()}>{t.addToCart} <span className="arrow" aria-hidden="true">→</span></button>
      {message && (
        <p className={`${styles.feedback} ${message.tone === "error" ? "field-error" : ""}`} role={message.tone === "error" ? "alert" : "status"}>
          {message.text} {message.tone === "ok" && <Link href="/panier" style={{ textDecoration: "underline" }}>{t.viewCart}</Link>}
        </p>
      )}
    </div>
  );
}
