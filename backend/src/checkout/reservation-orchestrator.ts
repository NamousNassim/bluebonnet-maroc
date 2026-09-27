import { Inject, Injectable, Logger } from "@nestjs/common";
import { APP_CONFIG, AppConfig } from "../config/app-config";
import { StartEntrepriseError } from "../integrations/startentreprise/errors";
import { INVENTORY_GATEWAY, InventoryGateway } from "../integrations/startentreprise/types";
import { PrismaService } from "../prisma/prisma.service";

export interface CheckoutLine {
  productId: string; catalogueItemId: string; name: string; sku: string | null;
  unitPriceCents: number; quantity: number; lineTotalCents: number;
}

/** Why a checkout could not reserve, in storefront terms. */
export class ReservationFailure extends Error {
  constructor(readonly reason: "OUT_OF_STOCK" | "PRODUCT_UNAVAILABLE" | "SERVICE_UNAVAILABLE", readonly line?: CheckoutLine,
      readonly internalCode?: string) {
    super(reason);
  }
}

/**
 * Reserves every stock-managed line of a checkout in StartEntreprise, or none of them.
 *
 * StartEntreprise has no atomic batch reservation yet, so lines are reserved one by one and any failure
 * releases what was already taken. Every reservation is recorded before moving on, so compensation is
 * durable: a release that fails is kept as RELEASE_FAILED for a later retry, and anything left behind
 * by a crash still expires on its own at StartEntreprise (TTL).
 *
 * The checkout reference is the reservation externalReference. The HTTP adapter derives a distinct,
 * stable Idempotency-Key from that reference plus the catalogue item, so retries cannot reserve twice
 * and separate lines cannot conflict with each other.
 */
@Injectable()
export class ReservationOrchestrator {
  private readonly logger = new Logger("ReservationOrchestrator");

  constructor(@Inject(INVENTORY_GATEWAY) private readonly inventory: InventoryGateway, private readonly prisma: PrismaService,
      @Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async reserveAll(checkout: { id: string; reference: string }, lines: CheckoutLine[], requestId?: string): Promise<{ expiresAt: Date | null }> {
    if (!this.inventory.enabled) throw new ReservationFailure("SERVICE_UNAVAILABLE", undefined, "INTEGRATION_DISABLED");
    let expiresAt: Date | null = null;
    for (const line of [...lines].sort((a, b) => a.catalogueItemId.localeCompare(b.catalogueItemId))) {
      try {
        const reservation = await this.inventory.reserve({
          catalogueItemId: line.catalogueItemId, quantity: line.quantity, externalReference: checkout.reference,
          expiresInSeconds: this.config.RESERVATION_TTL_SECONDS,
        }, requestId);
        const lineExpiry = new Date(reservation.expiresAt);
        await this.prisma.checkoutReservation.create({ data: {
          checkoutId: checkout.id, productId: line.productId, catalogueItemId: line.catalogueItemId, quantity: line.quantity,
          startEntrepriseReservationId: reservation.id, expiresAt: lineExpiry,
        } });
        if (!expiresAt || lineExpiry < expiresAt) expiresAt = lineExpiry;
      } catch (error) {
        // A product whose stock StartEntreprise does not track has nothing to protect.
        if (error instanceof StartEntrepriseError && error.isNotStockManaged) continue;
        const released = await this.compensate(checkout.id, requestId);
        this.logger.warn(`checkout ${checkout.reference} reservation failed code=${error instanceof StartEntrepriseError ? error.code : "UNEXPECTED"} `
            + `line=${line.catalogueItemId} requestId=${requestId ?? "-"} `
            + `startEntrepriseRequestId=${error instanceof StartEntrepriseError ? error.upstreamRequestId ?? "-" : "-"} `
            + `released=${released.released} releaseFailed=${released.failed}`);
        throw toFailure(error, line);
      }
    }
    return { expiresAt };
  }

  /** Releases every still-active reservation of a checkout; never throws. */
  async compensate(checkoutId: string, requestId?: string): Promise<{ released: number; failed: number }> {
    const active = await this.prisma.checkoutReservation.findMany({ where: { checkoutId, status: { in: ["ACTIVE", "RELEASE_FAILED"] } } });
    let released = 0;
    let failed = 0;
    for (const reservation of active) {
      try {
        await this.inventory.release(reservation.startEntrepriseReservationId, requestId);
        await this.prisma.checkoutReservation.update({ where: { id: reservation.id }, data: { status: "RELEASED" } });
        released++;
      } catch (error) {
        failed++;
        await this.prisma.checkoutReservation.update({ where: { id: reservation.id }, data: { status: "RELEASE_FAILED" } });
        this.logger.error(`release failed checkoutSessionId=${checkoutId} reservation=${reservation.startEntrepriseReservationId} `
          + `requestId=${requestId ?? "-"} startEntrepriseRequestId=${error instanceof StartEntrepriseError ? error.upstreamRequestId ?? "-" : "-"} `
          + `code=${error instanceof StartEntrepriseError ? error.code : "UNEXPECTED"}`);
      }
    }
    return { released, failed };
  }
}

function toFailure(error: unknown, line: CheckoutLine): ReservationFailure {
  if (!(error instanceof StartEntrepriseError)) return new ReservationFailure("SERVICE_UNAVAILABLE", line, "UNEXPECTED");
  if (error.isInsufficientStock || error.code === "RESERVATION_NOT_ACTIVE") return new ReservationFailure("OUT_OF_STOCK", line, error.code);
  if (["INVENTORY_ITEM_NOT_REGISTERED", "INVENTORY_STOCK_NOT_INITIALIZED", "DEFAULT_WAREHOUSE_NOT_CONFIGURED"].includes(error.code)) {
    return new ReservationFailure("PRODUCT_UNAVAILABLE", line, error.code);
  }
  return new ReservationFailure("SERVICE_UNAVAILABLE", line, error.code);
}
