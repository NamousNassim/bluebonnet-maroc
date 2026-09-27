import { Logger } from "@nestjs/common";
import { StartEntrepriseClient } from "./client";
import { StartEntrepriseError } from "./errors";
import { Availability, InventoryGateway, Reservation, ReservationRequest } from "./types";

const MAX_BATCH = 100;

/** Live adapter for the public inventory API. Availability is cached briefly to spare StartEntreprise. */
export class HttpInventoryGateway implements InventoryGateway {
  readonly enabled = true;
  private readonly logger = new Logger("StartEntrepriseInventory");
  private readonly cache = new Map<string, { value: Availability; until: number }>();

  constructor(private readonly client: StartEntrepriseClient, private readonly cacheSeconds: number, private readonly now: () => number = Date.now) {}

  async availability(catalogueItemIds: string[], requestId?: string): Promise<Map<string, Availability>> {
    const result = new Map<string, Availability>();
    const missing: string[] = [];
    for (const id of new Set(catalogueItemIds)) {
      const cached = this.cache.get(id);
      if (cached && cached.until > this.now()) result.set(id, cached.value); else missing.push(id);
    }
    for (let index = 0; index < missing.length; index += MAX_BATCH) {
      const batch = missing.slice(index, index + MAX_BATCH);
      try {
        const response = await this.client.request<{ items: Availability[] }>({
          method: "GET", path: `/api/public/v1/inventory/availability?catalogueItemIds=${batch.join(",")}`, requestId, retryable: true,
        });
        for (const item of response.items) {
          result.set(item.catalogueItemId, item);
          if (this.cacheSeconds > 0) this.cache.set(item.catalogueItemId, { value: item, until: this.now() + this.cacheSeconds * 1000 });
        }
      } catch (error) {
        // Availability is informational: an outage degrades to "unknown", it never breaks browsing.
        this.logger.warn(`availability degraded requestId=${requestId ?? "-"} code=${error instanceof StartEntrepriseError ? error.code : "UNEXPECTED"}`);
      }
    }
    for (const id of catalogueItemIds) if (!result.has(id)) result.set(id, { catalogueItemId: id, status: "UNKNOWN" });
    return result;
  }

  async reserve(request: ReservationRequest, requestId?: string): Promise<Reservation> {
    const reservation = await this.client.request<Reservation>({
      method: "POST", path: "/api/public/v1/inventory/reservations", requestId, retryable: true,
      idempotencyKey: reservationIdempotencyKey(request),
      body: { ...request, source: "ECOMMERCE" },
    });
    // A replayed reference returns the existing reservation, whatever its state.
    if (reservation.status !== "ACTIVE") {
      throw new StartEntrepriseError("RESERVATION_NOT_ACTIVE", 409, false, `Reservation ${reservation.id} is ${reservation.status}`);
    }
    this.cache.delete(request.catalogueItemId);
    return reservation;
  }

  async release(reservationId: string, requestId?: string): Promise<Reservation> {
    return this.client.request<Reservation>({
      method: "POST", path: `/api/public/v1/inventory/reservations/${encodeURIComponent(reservationId)}/release`, requestId, retryable: true,
    });
  }

  async consume(reservationId: string, requestId?: string): Promise<Reservation> {
    return this.client.request<Reservation>({
      method: "POST", path: `/api/public/v1/inventory/reservations/${encodeURIComponent(reservationId)}/consume`, requestId, retryable: true,
    });
  }
}

/** Stable per checkout line and safely below StartEntreprise's 200-character header limit. */
export function reservationIdempotencyKey(request: ReservationRequest): string {
  return `bb-reserve:${request.externalReference}:${request.catalogueItemId}`;
}

/** Used until StartEntreprise ships its public API: availability is unknown and nothing can be reserved. */
export class DisabledInventoryGateway implements InventoryGateway {
  readonly enabled = false;
  async availability(catalogueItemIds: string[]): Promise<Map<string, Availability>> {
    return new Map(catalogueItemIds.map((id) => [id, { catalogueItemId: id, status: "UNKNOWN" } as Availability]));
  }
  async reserve(): Promise<Reservation> {
    throw new StartEntrepriseError("INTEGRATION_DISABLED", undefined, false, "StartEntreprise integration is disabled");
  }
  async release(): Promise<Reservation> {
    throw new StartEntrepriseError("INTEGRATION_DISABLED", undefined, false, "StartEntreprise integration is disabled");
  }
  async consume(): Promise<Reservation> {
    throw new StartEntrepriseError("INTEGRATION_DISABLED", undefined, false, "StartEntreprise integration is disabled");
  }
}
