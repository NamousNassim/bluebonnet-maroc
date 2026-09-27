"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container" style={{ display: "grid", justifyItems: "center", gap: 16, padding: "72px 0", textAlign: "center" }}>
      <h1>Service momentanément indisponible</h1>
      <p className="hint">Veuillez réessayer dans un instant. <span lang="ar" dir="rtl">الخدمة غير متاحة مؤقتاً.</span></p>
      <button className="button" type="button" onClick={reset}>Réessayer</button>
    </div>
  );
}
