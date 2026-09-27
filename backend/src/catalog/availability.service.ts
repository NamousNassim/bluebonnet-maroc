import { Inject, Injectable } from "@nestjs/common";
import { APP_CONFIG, AppConfig } from "../config/app-config";
import { Availability } from "../integrations/startentreprise/types";
import { INVENTORY_GATEWAY, InventoryGateway } from "../integrations/startentreprise/types";

/** What a shopper may see: never the raw stock, only a coarse state and a "few left" hint. */
export interface DisplayAvailability {
  state: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "UNKNOWN";
  remaining?: number;
}

@Injectable()
export class AvailabilityService {
  constructor(@Inject(INVENTORY_GATEWAY) private readonly inventory: InventoryGateway, @Inject(APP_CONFIG) private readonly config: AppConfig) {}

  /** One batched StartEntreprise call for a whole page of products — never one call per product. */
  async forCatalogueIds(catalogueIds: string[], requestId?: string): Promise<Map<string, DisplayAvailability>> {
    if (!catalogueIds.length) return new Map();
    const raw = await this.inventory.availability(catalogueIds, requestId);
    return new Map(catalogueIds.map((id) => [id, this.display(raw.get(id))]));
  }

  display(value: Availability | undefined): DisplayAvailability {
    if (!value) return { state: "UNKNOWN" };
    switch (value.status) {
      case "NOT_TRACKED": return { state: "IN_STOCK" };
      case "OUT_OF_STOCK": return { state: "OUT_OF_STOCK" };
      case "IN_STOCK":
      case "LOW_STOCK": {
        const quantity = Math.floor(value.quantityAvailable ?? 0);
        if (quantity <= 0) return { state: "OUT_OF_STOCK" };
        return quantity <= this.config.LOW_STOCK_DISPLAY_THRESHOLD ? { state: "LOW_STOCK", remaining: quantity } : { state: "IN_STOCK" };
      }
      default: return { state: "UNKNOWN" };
    }
  }
}
