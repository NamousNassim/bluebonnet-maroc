import { Body, Controller, Get, Headers, HttpCode, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ManagementAuthGuard } from "./management-auth.guard";
import { ManagementService } from "./management.service";

/**
 * Machine-to-machine only (StartEntreprise → Bluebonnet). Not routed publicly: Caddy refuses
 * /api/internal/* and the storefront proxy only forwards /api/v1/*.
 */
@Controller("api/internal/v1/management")
@UseGuards(ManagementAuthGuard)
export class ManagementController {
  constructor(private readonly management: ManagementService) {}

  @Get("connection") connection() { return this.management.connection(); }

  @Get("categories") categories() { return this.management.categories(); }
  @Post("categories") createCategory(@Body() body: unknown) { return this.management.createCategory(body); }
  @Put("categories/:id") updateCategory(@Param("id") id: string, @Body() body: unknown) {
    return this.management.updateCategory(id, body);
  }

  @Get("products") listings(@Query("organizationId") organizationId?: string) {
    return this.management.listings(organizationId);
  }
  @Get("products/:listingId") listing(@Param("listingId") listingId: string, @Query("organizationId") organizationId?: string) {
    return this.management.listing(listingId, organizationId);
  }
  @Put("products/:listingId") publish(@Param("listingId") listingId: string, @Body() body: unknown,
      @Headers("idempotency-key") idempotencyKey?: string, @Headers("x-request-id") requestId?: string) {
    return this.management.publish(listingId, body, idempotencyKey, requestId);
  }
  @Post("products/:listingId/unpublish") @HttpCode(200) unpublish(@Param("listingId") listingId: string, @Body() body: unknown,
      @Headers("idempotency-key") idempotencyKey?: string, @Headers("x-request-id") requestId?: string) {
    return this.management.unpublish(listingId, body, idempotencyKey, requestId);
  }
}
