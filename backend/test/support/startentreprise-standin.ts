import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";

/**
 * In-process stand-in for the StartEntreprise public API contract v1. It reproduces what Bluebonnet
 * relies on — client-credentials tokens, batch availability, integration-scoped Idempotency-Key
 * reservations, release and consume — plus switches to inject 401/403/429/503 answers.
 */
export class StartEntrepriseStandIn {
  readonly stock = new Map<string, { onHand: number; reserved: number; tracked: boolean }>();
  readonly reservations = new Map<string, { id: string; catalogueItemId: string; quantity: number; status: string; expiresAt: string; externalReference: string }>();
  readonly calls: { method: string; path: string; requestId?: string; idempotencyKey?: string; authorization?: string }[] = [];
  readonly idempotency = new Map<string, { fingerprint: string; reservationId: string }>();
  tokenRequests = 0;
  validTokens = new Set<string>();
  secret = "standin-secret";
  /** Queued failures, consumed in order by matching requests. */
  failures: { match: (method: string, path: string) => boolean; status: number; code?: string; retryAfter?: number }[] = [];
  /** Reserve/release attempts fail for these catalogue ids with the given code. */
  rejectReservation = new Map<string, { status: number; code: string }>();
  failRelease = new Set<string>();
  private server?: Server;

  get url(): string { return `http://127.0.0.1:${(this.server!.address() as AddressInfo).port}`; }

  async start(): Promise<this> {
    this.server = createServer((request, response) => void this.handle(request, response));
    await new Promise<void>((resolve) => this.server!.listen(0, "127.0.0.1", resolve));
    return this;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => this.server?.close(() => resolve()));
  }

  setStock(catalogueItemId: string, onHand: number, tracked = true): void {
    this.stock.set(catalogueItemId, { onHand, reserved: 0, tracked });
  }

  reset(): void {
    this.stock.clear(); this.reservations.clear(); this.idempotency.clear(); this.calls.length = 0; this.failures = [];
    this.rejectReservation.clear(); this.failRelease.clear(); this.tokenRequests = 0; this.validTokens.clear();
  }

  available(catalogueItemId: string): number {
    const line = this.stock.get(catalogueItemId);
    return line ? line.onHand - line.reserved : 0;
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? "/", "http://standin");
    const body = await readBody(request);
    const requestId = request.headers["x-request-id"] as string | undefined;
    const send = (status: number, json?: unknown, headers: Record<string, string> = {}) => {
      response.writeHead(status, { "Content-Type": status >= 400 ? "application/problem+json" : "application/json",
        ...(requestId ? { "X-Request-Id": requestId } : {}), ...headers });
      response.end(json === undefined ? undefined : JSON.stringify(json));
    };
    if (url.pathname === "/token") {
      this.tokenRequests++;
      const form = new URLSearchParams(body);
      if (form.get("client_secret") !== this.secret) return send(401, { error: "invalid_client" });
      const token = `token-${this.tokenRequests}`;
      this.validTokens.add(token);
      return send(200, { access_token: token, expires_in: 300, token_type: "Bearer" });
    }
    const authorization = request.headers.authorization;
    this.calls.push({ method: request.method!, path: url.pathname + url.search, requestId,
      idempotencyKey: request.headers["idempotency-key"] as string | undefined, authorization });
    const failure = this.failures.findIndex((candidate) => candidate.match(request.method!, url.pathname));
    if (failure >= 0) {
      const [injected] = this.failures.splice(failure, 1);
      return send(injected.status, { code: injected.code, detail: "injected" }, injected.retryAfter ? { "Retry-After": String(injected.retryAfter) } : {});
    }
    if (!authorization?.startsWith("Bearer ") || !this.validTokens.has(authorization.slice(7))) return send(401, { code: "UNAUTHORIZED" });

    if (request.method === "GET" && url.pathname === "/api/public/v1/inventory/availability") {
      const ids = (url.searchParams.get("catalogueItemIds") ?? "").split(",").filter(Boolean);
      if (ids.length > 100) return send(400, { code: "INVENTORY_TOO_MANY_IDS" });
      return send(200, { items: ids.map((id) => {
        const line = this.stock.get(id);
        if (!line) return { catalogueItemId: id, status: "NOT_REGISTERED" };
        if (!line.tracked) return { catalogueItemId: id, status: "NOT_TRACKED" };
        const available = line.onHand - line.reserved;
        return { catalogueItemId: id, status: available <= 0 ? "OUT_OF_STOCK" : available <= 3 ? "LOW_STOCK" : "IN_STOCK", quantityAvailable: available };
      }) });
    }
    if (request.method === "POST" && url.pathname === "/api/public/v1/inventory/reservations") {
      const input = JSON.parse(body) as { catalogueItemId: string; quantity: number; externalReference: string; expiresInSeconds: number };
      const idempotencyKey = request.headers["idempotency-key"] as string | undefined;
      if (!idempotencyKey) return send(400, { code: "INVENTORY_IDEMPOTENCY_KEY_REQUIRED" });
      const fingerprint = JSON.stringify(input);
      const previous = this.idempotency.get(idempotencyKey);
      if (previous) {
        if (previous.fingerprint !== fingerprint) return send(409, { code: "INVENTORY_IDEMPOTENCY_CONFLICT" });
        return send(200, this.reservations.get(previous.reservationId));
      }
      const rejection = this.rejectReservation.get(input.catalogueItemId);
      if (rejection) return send(rejection.status, { code: rejection.code, detail: "rejected" });
      const replay = [...this.reservations.values()].find((value) => value.externalReference === input.externalReference && value.catalogueItemId === input.catalogueItemId);
      if (replay) return send(200, replay);
      const line = this.stock.get(input.catalogueItemId);
      if (!line) return send(404, { code: "INVENTORY_ITEM_NOT_REGISTERED" });
      if (!line.tracked) return send(409, { code: "INVENTORY_STOCK_TRACKING_DISABLED" });
      if (line.onHand - line.reserved < input.quantity) return send(409, { code: "INVENTORY_INSUFFICIENT_STOCK" });
      line.reserved += input.quantity;
      const reservation = { id: randomUUID(), catalogueItemId: input.catalogueItemId, quantity: input.quantity, status: "ACTIVE",
        expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000).toISOString(), externalReference: input.externalReference };
      this.reservations.set(reservation.id, reservation);
      this.idempotency.set(idempotencyKey, { fingerprint, reservationId: reservation.id });
      return send(201, reservation);
    }
    const release = /^\/api\/public\/v1\/inventory\/reservations\/([^/]+)\/release$/.exec(url.pathname);
    if (request.method === "POST" && release) {
      const reservation = this.reservations.get(release[1]);
      if (!reservation) return send(404, { code: "INVENTORY_RESERVATION_NOT_FOUND" });
      if (this.failRelease.has(reservation.catalogueItemId)) return send(503, { code: "UNAVAILABLE" });
      if (reservation.status === "ACTIVE") {
        reservation.status = "RELEASED";
        this.stock.get(reservation.catalogueItemId)!.reserved -= reservation.quantity;
      }
      return send(200, reservation);
    }
    const consume = /^\/api\/public\/v1\/inventory\/reservations\/([^/]+)\/consume$/.exec(url.pathname);
    if (request.method === "POST" && consume) {
      const reservation = this.reservations.get(consume[1]);
      if (!reservation) return send(404, { code: "INVENTORY_RESERVATION_NOT_FOUND" });
      if (reservation.status === "RELEASED") return send(409, { code: "INVENTORY_RESERVATION_ALREADY_RELEASED" });
      if (reservation.status === "EXPIRED") return send(409, { code: "INVENTORY_RESERVATION_EXPIRED" });
      if (reservation.status === "ACTIVE") {
        reservation.status = "CONSUMED";
        const stock = this.stock.get(reservation.catalogueItemId)!;
        stock.reserved -= reservation.quantity;
        stock.onHand -= reservation.quantity;
      }
      return send(200, reservation);
    }
    return send(404, { code: "NOT_FOUND" });
  }
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    request.on("data", (chunk) => { data += chunk; });
    request.on("end", () => resolve(data));
  });
}
