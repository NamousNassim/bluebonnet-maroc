import type { Locale } from "./i18n";

const formatters: Record<Locale, Intl.NumberFormat> = {
  fr: new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
  ar: new Intl.NumberFormat("ar-MA", { minimumFractionDigits: 0, maximumFractionDigits: 2, numberingSystem: "latn" }),
};

/** 24500 → "245 DH"; 24550 → "245,5 DH"; 113000 → "1 130 DH" (space grouping, never "1.130"). Prices are always integers in centimes. */
export function formatPrice(cents: number, locale: Locale = "fr"): string {
  const amount = formatters[locale].format(cents / 100);
  return locale === "ar" ? `${amount} درهم` : `${amount} DH`;
}
