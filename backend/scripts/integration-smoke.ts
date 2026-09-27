import { randomUUID } from "node:crypto";
import { z } from "zod";
import { loadConfig } from "../src/config/app-config";
import { TokenProvider } from "../src/integrations/startentreprise/auth";
import { StartEntrepriseClient } from "../src/integrations/startentreprise/client";
import { HttpInventoryGateway } from "../src/integrations/startentreprise/inventory";
import type { Reservation } from "../src/integrations/startentreprise/types";

async function main(): Promise<void> {
  const catalogueItemId = z.string().uuid().parse(process.argv[2]);
  const quantity = z.coerce.number().int().min(1).max(100).parse(process.argv[3] ?? "1");
  const config = loadConfig();
  if (!config.STARTENTREPRISE_INTEGRATION_ENABLED) throw new Error("smoke test requires STARTENTREPRISE_INTEGRATION_ENABLED=true");
  const tokens = new TokenProvider({ tokenUrl: config.STARTENTREPRISE_TOKEN_URL!, clientId: config.STARTENTREPRISE_CLIENT_ID!,
    clientSecret: config.STARTENTREPRISE_CLIENT_SECRET!, timeoutMs: config.STARTENTREPRISE_TIMEOUT_MS });
  const inventory = new HttpInventoryGateway(
    new StartEntrepriseClient(config.STARTENTREPRISE_API_URL!, tokens, config.STARTENTREPRISE_TIMEOUT_MS), 0,
  );
  const requestId = `bb-smoke-${randomUUID()}`;
  const externalReference = `BB-SMOKE-${Date.now()}`;
  let reservation: Reservation | undefined;
  let released = false;
  try {
    const before = (await inventory.availability([catalogueItemId], requestId)).get(catalogueItemId);
    if (!before || !["IN_STOCK", "LOW_STOCK"].includes(before.status) || (before.quantityAvailable ?? 0) < quantity) {
      throw new Error(`product is not reservable for smoke test: ${before?.status ?? "UNKNOWN"}`);
    }
    reservation = await inventory.reserve({ catalogueItemId, quantity, externalReference, expiresInSeconds: config.RESERVATION_TTL_SECONDS }, requestId);
    const replay = await inventory.reserve({ catalogueItemId, quantity, externalReference, expiresInSeconds: config.RESERVATION_TTL_SECONDS }, requestId);
    if (replay.id !== reservation.id) throw new Error("idempotent replay returned a different reservation");
    const during = (await inventory.availability([catalogueItemId], requestId)).get(catalogueItemId);
    const release = await inventory.release(reservation.id, requestId);
    released = release.status === "RELEASED";
    if (!released) throw new Error(`release returned unexpected state ${release.status}`);
    const after = (await inventory.availability([catalogueItemId], requestId)).get(catalogueItemId);
    console.log(JSON.stringify({ requestId, catalogueItemId, externalReference, reservationId: reservation.id,
      replayedReservationId: replay.id, before, during, after, releaseStatus: release.status }, null, 2));
  } finally {
    if (reservation && !released) {
      try { await inventory.release(reservation.id, requestId); } catch { /* expiry remains the final safety net */ }
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
