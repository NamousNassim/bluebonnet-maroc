import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { ConfigModule } from "./config/config.module";
import { ErrorFilter } from "./common/error.filter";
import { RequestIdMiddleware } from "./common/request-id.middleware";
import { AvailabilityService } from "./catalog/availability.service";
import { CatalogController } from "./catalog/catalog.controller";
import { CatalogService } from "./catalog/catalog.service";
import { CartController } from "./cart/cart.controller";
import { CartService } from "./cart/cart.service";
import { CheckoutController } from "./checkout/checkout.controller";
import { CheckoutService } from "./checkout/checkout.service";
import { ReservationOrchestrator } from "./checkout/reservation-orchestrator";
import { HealthController } from "./health.controller";
import { StartEntrepriseModule } from "./integrations/startentreprise/startentreprise.module";
import { OrderService } from "./orders/order.service";
import { PrismaService } from "./prisma/prisma.service";
import { ManagementController } from "./management/management.controller";
import { ManagementAuthGuard } from "./management/management-auth.guard";
import { ManagementService } from "./management/management.service";

@Module({
  imports: [ConfigModule, StartEntrepriseModule],
  controllers: [HealthController, CatalogController, CartController, CheckoutController, ManagementController],
  providers: [
    { provide: APP_FILTER, useClass: ErrorFilter },
    PrismaService, AvailabilityService, CatalogService, CartService, CheckoutService, ReservationOrchestrator, OrderService,
    ManagementAuthGuard, ManagementService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes("*path");
  }
}
