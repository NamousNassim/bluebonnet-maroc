import { Global, Module } from "@nestjs/common";
import { APP_CONFIG, AppConfig } from "../../config/app-config";
import { TokenProvider } from "./auth";
import { StartEntrepriseClient } from "./client";
import { DisabledInventoryGateway, HttpInventoryGateway } from "./inventory";
import { INVENTORY_GATEWAY, InventoryGateway } from "./types";

/** The only place Bluebonnet knows how to reach StartEntreprise. */
@Global()
@Module({
  providers: [{
    provide: INVENTORY_GATEWAY,
    inject: [APP_CONFIG],
    useFactory: (config: AppConfig): InventoryGateway => {
      if (!config.STARTENTREPRISE_INTEGRATION_ENABLED) return new DisabledInventoryGateway();
      const tokens = new TokenProvider({
        tokenUrl: config.STARTENTREPRISE_TOKEN_URL!, clientId: config.STARTENTREPRISE_CLIENT_ID!,
        clientSecret: config.STARTENTREPRISE_CLIENT_SECRET!, timeoutMs: config.STARTENTREPRISE_TIMEOUT_MS,
      });
      return new HttpInventoryGateway(new StartEntrepriseClient(config.STARTENTREPRISE_API_URL!, tokens, config.STARTENTREPRISE_TIMEOUT_MS),
          config.AVAILABILITY_CACHE_SECONDS);
    },
  }],
  exports: [INVENTORY_GATEWAY],
})
export class StartEntrepriseModule {}
