import { TokenProvider } from "../src/integrations/startentreprise/auth";
import { StartEntrepriseClient } from "../src/integrations/startentreprise/client";
import { DisabledInventoryGateway, HttpInventoryGateway } from "../src/integrations/startentreprise/inventory";
import { StartEntrepriseStandIn } from "./support/startentreprise-standin";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("StartEntreprise adapter (contract v1, over HTTP)", () => {
  const standIn = new StartEntrepriseStandIn();
  let clock = 1_000_000;
  const gateway = (cacheSeconds = 0, secret = standIn.secret) => {
    const tokens = new TokenProvider({ tokenUrl: `${standIn.url}/token`, clientId: "bluebonnet", clientSecret: secret, timeoutMs: 1000 }, fetch, () => clock);
    return new HttpInventoryGateway(new StartEntrepriseClient(standIn.url, tokens, 1000), cacheSeconds, () => clock);
  };

  beforeAll(() => standIn.start());
  afterAll(() => standIn.stop());
  beforeEach(() => { standIn.reset(); clock = 1_000_000; });

  it("fetches availability for a whole page in one call, with a cached client-credentials token", async () => {
    standIn.setStock(A, 12); standIn.setStock(B, 0);
    const inventory = gateway();
    const first = await inventory.availability([A, B, "33333333-3333-4333-8333-333333333333"], "req-12345678");
    await inventory.availability([A]);

    expect(first.get(A)).toEqual({ catalogueItemId: A, status: "IN_STOCK", quantityAvailable: 12 });
    expect(first.get(B)?.status).toBe("OUT_OF_STOCK");
    expect(first.get("33333333-3333-4333-8333-333333333333")?.status).toBe("NOT_REGISTERED");
    expect(standIn.calls).toHaveLength(2);
    expect(standIn.calls[0].path).toContain(`catalogueItemIds=${A},${B}`);
    expect(standIn.calls[0].requestId).toBe("req-12345678");
    expect(standIn.tokenRequests).toBe(1);
  });

  it("splits very large pages into batches of 100", async () => {
    const ids = Array.from({ length: 150 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`);
    await gateway().availability(ids);
    expect(standIn.calls).toHaveLength(2);
  });

  it("serves repeated availability from a short cache", async () => {
    standIn.setStock(A, 5);
    const inventory = gateway(30);
    await inventory.availability([A]);
    await inventory.availability([A]);
    expect(standIn.calls).toHaveLength(1);
    clock += 31_000;
    await inventory.availability([A]);
    expect(standIn.calls).toHaveLength(2);
  });

  it("refreshes an expired or revoked token once on 401", async () => {
    standIn.setStock(A, 5);
    const inventory = gateway();
    await inventory.availability([A]);
    standIn.validTokens.clear();
    const result = await inventory.availability([A]);
    expect(result.get(A)?.status).toBe("IN_STOCK");
    expect(standIn.tokenRequests).toBe(2);
    clock += 400_000;
    await inventory.availability([A]);
    expect(standIn.tokenRequests).toBe(3);
  });

  it("degrades availability to UNKNOWN instead of breaking browsing", async () => {
    standIn.setStock(A, 5);
    standIn.failures.push({ match: () => true, status: 503 }, { match: () => true, status: 503 });
    expect((await gateway().availability([A])).get(A)).toEqual({ catalogueItemId: A, status: "UNKNOWN" });
    standIn.failures.push({ match: () => true, status: 403, code: "SCOPE_REQUIRED" });
    expect((await gateway().availability([A])).get(A)?.status).toBe("UNKNOWN");
    expect((await gateway(0, "wrong-secret").availability([A])).get(A)?.status).toBe("UNKNOWN");
  });

  it("retries a transient 503 once, but never retries 403 and surfaces 429 with Retry-After", async () => {
    standIn.setStock(A, 5);
    const inventory = gateway();
    standIn.failures.push({ match: (method) => method === "POST", status: 503 });
    const reservation = await inventory.reserve({ catalogueItemId: A, quantity: 2, externalReference: "BB-CHK-1", expiresInSeconds: 900 });
    expect(reservation.status).toBe("ACTIVE");
    expect(standIn.available(A)).toBe(3);

    standIn.failures.push({ match: (method) => method === "POST", status: 403, code: "SCOPE_REQUIRED" });
    await expect(inventory.reserve({ catalogueItemId: A, quantity: 1, externalReference: "BB-CHK-2", expiresInSeconds: 900 }))
      .rejects.toMatchObject({ code: "SCOPE_REQUIRED", retryable: false, httpStatus: 403 });

    standIn.failures.push({ match: (method) => method === "POST", status: 429, retryAfter: 7 });
    await expect(inventory.reserve({ catalogueItemId: A, quantity: 1, externalReference: "BB-CHK-3", expiresInSeconds: 900 }))
      .rejects.toMatchObject({ code: "RATE_LIMITED", httpStatus: 429, retryAfterSeconds: 7 });
  });

  it("maps business rejections and refuses a replayed reference that is no longer active", async () => {
    standIn.setStock(A, 1);
    const inventory = gateway();
    await expect(inventory.reserve({ catalogueItemId: A, quantity: 2, externalReference: "BB-CHK-4", expiresInSeconds: 900 }))
      .rejects.toMatchObject({ code: "INVENTORY_INSUFFICIENT_STOCK", retryable: false, isInsufficientStock: true });
    const reservation = await inventory.reserve({ catalogueItemId: A, quantity: 1, externalReference: "BB-CHK-5", expiresInSeconds: 900 });
    expect((await inventory.release(reservation.id)).status).toBe("RELEASED");
    expect((await inventory.release(reservation.id)).status).toBe("RELEASED");
    await expect(inventory.reserve({ catalogueItemId: A, quantity: 1, externalReference: "BB-CHK-5", expiresInSeconds: 900 }))
      .rejects.toMatchObject({ code: "RESERVATION_NOT_ACTIVE" });
    expect(standIn.available(A)).toBe(1);
  });

  it("reports unreachable services as retryable transport failures", async () => {
    const tokens = new TokenProvider({ tokenUrl: "http://127.0.0.1:9/token", clientId: "x", clientSecret: "y", timeoutMs: 300 });
    const inventory = new HttpInventoryGateway(new StartEntrepriseClient("http://127.0.0.1:9", tokens, 300), 0);
    await expect(inventory.reserve({ catalogueItemId: A, quantity: 1, externalReference: "BB-CHK-6", expiresInSeconds: 900 }))
      .rejects.toMatchObject({ code: "AUTH_UNAVAILABLE", retryable: true });
  });

  it("stays inert while the integration is disabled", async () => {
    const disabled = new DisabledInventoryGateway();
    expect(disabled.enabled).toBe(false);
    expect((await disabled.availability([A])).get(A)?.status).toBe("UNKNOWN");
    await expect(disabled.reserve()).rejects.toMatchObject({ code: "INTEGRATION_DISABLED" });
  });
});
