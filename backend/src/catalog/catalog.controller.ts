import { Controller, Get, Headers, Param, Query } from "@nestjs/common";
import { CatalogService, productQuerySchema } from "./catalog.service";

@Controller("v1")
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("categories") categories() { return this.catalog.categories(); }
  @Get("categories/:slug") category(@Param("slug") slug: string) { return this.catalog.category(slug); }

  @Get("products")
  products(@Query() query: Record<string, string>, @Headers("x-request-id") requestId?: string) {
    return this.catalog.products(productQuerySchema.parse(query), requestId);
  }

  @Get("products/:slug")
  product(@Param("slug") slug: string, @Headers("x-request-id") requestId?: string) { return this.catalog.product(slug, requestId); }

  @Get("sitemap") sitemap() { return this.catalog.sitemap(); }
}
