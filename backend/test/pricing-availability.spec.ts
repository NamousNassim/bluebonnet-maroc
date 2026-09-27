import { totals } from "../src/cart/pricing";
import { AvailabilityService } from "../src/catalog/availability.service";
import type { AppConfig } from "../src/config/app-config";
import type { Availability, InventoryGateway } from "../src/integrations/startentreprise/types";

describe("cart totals", () => {
  const config = { SHIPPING_FLAT_CENTS: 3000, FREE_SHIPPING_THRESHOLD_CENTS: 80000 };

  it("adds flat shipping below the free-shipping threshold", () => {
    expect(totals(24500, config)).toEqual({ subtotalCents: 24500, shippingCents: 3000, totalCents: 27500, freeShippingFromCents: 80000 });
  });

  it("offers shipping from the threshold, inclusive", () => {
    expect(totals(79999, config).shippingCents).toBe(3000);
    expect(totals(80000, config)).toMatchObject({ shippingCents: 0, totalCents: 80000 });
  });

  it("charges nothing for an empty cart and supports disabling free shipping", () => {
    expect(totals(0, config)).toMatchObject({ shippingCents: 0, totalCents: 0 });
    expect(totals(500000, { ...config, FREE_SHIPPING_THRESHOLD_CENTS: 0 }).shippingCents).toBe(3000);
  });
});

describe("displayed availability", () => {
  const calls: string[][] = [];
  const gateway: InventoryGateway = {
    enabled: true,
    availability: async (ids: string[]) => { calls.push(ids); return new Map<string, Availability>(ids.map((id) => [id, { catalogueItemId: id, status: "IN_STOCK", quantityAvailable: 40 }])); },
    reserve: async () => { throw new Error("unused"); },
    release: async () => { throw new Error("unused"); },
  } as unknown as InventoryGateway;
  const service = new AvailabilityService(gateway, { LOW_STOCK_DISPLAY_THRESHOLD: 5 } as AppConfig);
  const of = (status: Availability["status"], quantityAvailable?: number) => service.display({ catalogueItemId: "x", status, quantityAvailable } as Availability);

  it("never exposes the stock level above the low-stock threshold", () => {
    expect(of("IN_STOCK", 250)).toEqual({ state: "IN_STOCK" });
    expect(of("LOW_STOCK", 6)).toEqual({ state: "IN_STOCK" });
  });

  it("hints at the few remaining units at or below the threshold", () => {
    expect(of("IN_STOCK", 5)).toEqual({ state: "LOW_STOCK", remaining: 5 });
    expect(of("LOW_STOCK", 1)).toEqual({ state: "LOW_STOCK", remaining: 1 });
  });

  it("maps empty, untracked, unregistered and missing answers", () => {
    expect(of("IN_STOCK", 0)).toEqual({ state: "OUT_OF_STOCK" });
    expect(of("OUT_OF_STOCK", 0)).toEqual({ state: "OUT_OF_STOCK" });
    expect(of("NOT_TRACKED")).toEqual({ state: "IN_STOCK" });
    expect(of("NOT_REGISTERED")).toEqual({ state: "UNKNOWN" });
    expect(of("UNKNOWN")).toEqual({ state: "UNKNOWN" });
    expect(service.display(undefined)).toEqual({ state: "UNKNOWN" });
  });

  it("asks StartEntreprise once per page and skips the call for an empty page", async () => {
    const result = await service.forCatalogueIds(["a", "b"]);
    expect(calls).toEqual([["a", "b"]]);
    expect(result.get("b")).toEqual({ state: "IN_STOCK" });
    expect((await service.forCatalogueIds([])).size).toBe(0);
    expect(calls).toHaveLength(1);
  });
});
