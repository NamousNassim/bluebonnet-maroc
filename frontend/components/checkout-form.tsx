"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { confirmCheckout, startCheckout, StorefrontError } from "@/lib/client-api";
import { dictionaries, type Locale } from "@/lib/i18n";
import styles from "./commerce.module.css";

/** Problems the shopper fixes in the cart rather than in this form. */
const CART_PROBLEMS = new Set(["INSUFFICIENT_STOCK", "PRODUCT_UNAVAILABLE", "CART_HAS_UNAVAILABLE_ITEMS", "CART_EMPTY"]);
const FIELDS = ["firstName", "lastName", "email", "phone", "addressLine", "city", "postalCode", "notes"] as const;

/**
 * Captures contact and delivery details. The server validates everything, prices the cart itself,
 * reserves stock and records the order; this form only reports what the server decided.
 */
export function CheckoutForm({ locale, enabled = true }: { locale: Locale; enabled?: boolean }) {
  const t = dictionaries[locale];
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ code?: string; message: string }>();
  const [fields, setFields] = useState<Record<string, string>>({});
  const alertRef = useRef<HTMLParagraphElement>(null);
  // On small screens the summary is far above the submit button: bring it into view and announce it.
  useEffect(() => { if (error) alertRef.current?.focus(); }, [error]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const form = Object.fromEntries(FIELDS.map((name) => [name, String(data.get(name) ?? "")]));
    setBusy(true); setError(undefined); setFields({});
    try {
      const checkout = await startCheckout(form);
      const confirmed = await confirmCheckout(checkout.id);
      window.dispatchEvent(new CustomEvent("bb:cart-updated", { detail: 0 }));
      router.push(`/commande/${confirmed.id}`);
    } catch (failure) {
      if (failure instanceof StorefrontError) {
        setError({ code: failure.problem.code, message: failure.problem.message });
        setFields(failure.problem.fields ?? {});
      } else setError({ message: t.genericError });
      setBusy(false);
    }
  }

  const field = (name: (typeof FIELDS)[number], label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, className = "") => (
    <div className={`field ${className}`}>
      <label htmlFor={`checkout-${name}`}>{label}</label>
      <input id={`checkout-${name}`} name={name} aria-invalid={Boolean(fields[name])} aria-describedby={fields[name] ? `${name}-error` : undefined} {...props} />
      {fields[name] && <span id={`${name}-error`} className="field-error">{fields[name]}</span>}
    </div>
  );

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
      {!enabled && <p className="notice" role="note">{t.checkoutClosed}</p>}
      {error && (
        <p ref={alertRef} tabIndex={-1} className="notice notice-error" role="alert">
          {error.message}{" "}
          {error.code && CART_PROBLEMS.has(error.code) && <Link href="/panier" style={{ textDecoration: "underline" }}>{t.viewCart}</Link>}
        </p>
      )}
      <fieldset className={styles.fieldset}>
        <legend>{t.contact}</legend>
        <div className={styles.twoColumns}>
          {field("firstName", t.firstName, { autoComplete: "given-name", required: true })}
          {field("lastName", t.lastName, { autoComplete: "family-name", required: true })}
          {field("email", t.email, { type: "email", autoComplete: "email", required: true })}
          {field("phone", t.phone, { type: "tel", autoComplete: "tel", required: true, placeholder: "06 12 34 56 78" })}
        </div>
      </fieldset>
      <fieldset className={styles.fieldset}>
        <legend>{t.delivery}</legend>
        <div className={styles.twoColumns}>
          {field("addressLine", t.address, { autoComplete: "street-address", required: true }, styles.full)}
          {field("city", t.city, { autoComplete: "address-level2", required: true })}
          {field("postalCode", t.postalCode, { autoComplete: "postal-code", inputMode: "numeric" })}
          <label className={`field ${styles.full}`}>
            {t.notes}
            <textarea name="notes" maxLength={1000} />
          </label>
        </div>
      </fieldset>
      <p className="hint">{t.paymentNote}</p>
      <button className="button" type="submit" disabled={busy || !enabled}>{busy ? t.processing : t.placeOrder}</button>
    </form>
  );
}
