import type { Metadata } from "next";
import { CartView } from "@/components/cart-view";
import { getDictionary } from "@/lib/locale";
import { getCart } from "@/lib/server-api";

export const metadata: Metadata = { title: "Panier", robots: { index: false, follow: false } };

export default async function CartPage() {
  const { locale, t } = await getDictionary();
  const cart = await getCart();
  return (
    <div className="container" style={{ paddingBottom: "clamp(40px, 7vw, 88px)" }}>
      <header className="page-head"><h1>{t.cartTitle}</h1></header>
      <CartView initial={cart} locale={locale} />
    </div>
  );
}
