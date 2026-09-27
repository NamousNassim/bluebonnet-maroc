/**
 * A failure talking to StartEntreprise, classified once here so callers never parse HTTP details.
 * `code` is StartEntreprise's stable problem code (or a transport code); it is logged, never shown.
 */
export class StartEntrepriseError extends Error {
  constructor(
    readonly code: string,
    readonly httpStatus: number | undefined,
    readonly retryable: boolean,
    message: string,
    readonly retryAfterSeconds?: number,
    readonly upstreamRequestId?: string,
  ) {
    super(message);
    this.name = "StartEntrepriseError";
  }

  get isInsufficientStock(): boolean { return this.code === "INVENTORY_INSUFFICIENT_STOCK"; }
  get isNotStockManaged(): boolean { return this.code === "INVENTORY_STOCK_TRACKING_DISABLED"; }
}
