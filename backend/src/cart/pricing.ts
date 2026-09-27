import { AppConfig } from "../config/app-config";

export interface Totals { subtotalCents: number; shippingCents: number; totalCents: number; freeShippingFromCents: number }

/**
 * Backend-authoritative totals. Prices are the shop's public (tax-inclusive) prices; fiscal documents
 * are StartEntreprise's responsibility later, so no VAT is computed here.
 */
export function totals(subtotalCents: number, config: Pick<AppConfig, "SHIPPING_FLAT_CENTS" | "FREE_SHIPPING_THRESHOLD_CENTS">): Totals {
  const free = config.FREE_SHIPPING_THRESHOLD_CENTS > 0 && subtotalCents >= config.FREE_SHIPPING_THRESHOLD_CENTS;
  const shippingCents = subtotalCents === 0 || free ? 0 : config.SHIPPING_FLAT_CENTS;
  return { subtotalCents, shippingCents, totalCents: subtotalCents + shippingCents, freeShippingFromCents: config.FREE_SHIPPING_THRESHOLD_CENTS };
}
