import Link from "next/link";
import { Sprig } from "@/components/brand";

export default function NotFound() {
  return (
    <div className="container" style={{ display: "grid", justifyItems: "center", gap: 16, padding: "72px 0", textAlign: "center" }}>
      <span style={{ color: "var(--periwinkle)" }} aria-hidden="true"><Sprig height={140} /></span>
      <h1>Page introuvable</h1>
      <p className="hint" lang="ar" dir="rtl">الصفحة غير موجودة</p>
      <Link className="button" href="/produits">Découvrir la collection</Link>
    </div>
  );
}
