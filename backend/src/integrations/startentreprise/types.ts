/** Types of the StartEntreprise public API contract v1 (docs/startentreprise-public-api-contract.md). */
export type AvailabilityStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "NOT_TRACKED" | "NOT_REGISTERED" | "UNKNOWN";

export interface Availability {
  catalogueItemId: string;
  status: AvailabilityStatus;
  /** Internal only: never forwarded to shoppers except as a coarse "only N left" hint. */
  quantityAvailable?: number;
}

export interface ReservationRequest {
  catalogueItemId: string;
  quantity: number;
  externalReference: string;
  expiresInSeconds: number;
}

export interface Reservation {
  id: string;
  status: "ACTIVE" | "CONSUMED" | "RELEASED" | "EXPIRED";
  quantity: number;
  expiresAt: string;
  externalReference: string;
}

/** Everything Bluebonnet needs from StartEntreprise inventory. Business code depends on this only. */
export interface InventoryGateway {
  readonly enabled: boolean;
  availability(catalogueItemIds: string[], requestId?: string): Promise<Map<string, Availability>>;
  reserve(request: ReservationRequest, requestId?: string): Promise<Reservation>;
  release(reservationId: string, requestId?: string): Promise<Reservation>;
}

export const INVENTORY_GATEWAY = Symbol("INVENTORY_GATEWAY");
