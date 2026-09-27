import { Controller, Get, Inject } from "@nestjs/common";
import { INVENTORY_GATEWAY, InventoryGateway } from "./integrations/startentreprise/types";
import { PrismaService } from "./prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService, @Inject(INVENTORY_GATEWAY) private readonly inventory: InventoryGateway) {}

  @Get()
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: "UP", startEntreprise: this.inventory.enabled ? "ENABLED" : "DISABLED" };
  }
}
