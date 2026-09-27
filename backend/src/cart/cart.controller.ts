import { Body, Controller, Delete, Get, Headers, Inject, Param, ParseUUIDPipe, Patch, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { APP_CONFIG, AppConfig } from "../config/app-config";
import { ClientHeaderGuard } from "../common/client-header.guard";
import { addItemSchema, CartService, setQuantitySchema } from "./cart.service";
import { readCartToken, writeCartToken } from "./cart-cookie";

@Controller("v1/cart")
export class CartController {
  constructor(private readonly carts: CartService, @Inject(APP_CONFIG) private readonly config: AppConfig) {}

  @Get()
  get(@Req() request: Request, @Headers("x-request-id") requestId?: string) {
    return this.carts.view(readCartToken(request), requestId);
  }

  @Post("items") @UseGuards(ClientHeaderGuard)
  async add(@Req() request: Request, @Res({ passthrough: true }) response: Response, @Body() body: unknown,
      @Headers("x-request-id") requestId?: string) {
    const result = await this.carts.add(readCartToken(request), addItemSchema.parse(body), requestId);
    writeCartToken(response, result.token, this.config);
    return result.cart;
  }

  @Patch("items/:productId") @UseGuards(ClientHeaderGuard)
  set(@Req() request: Request, @Param("productId", ParseUUIDPipe) productId: string, @Body() body: unknown,
      @Headers("x-request-id") requestId?: string) {
    return this.carts.setQuantity(readCartToken(request), productId, setQuantitySchema.parse(body).quantity, requestId);
  }

  @Delete("items/:productId") @UseGuards(ClientHeaderGuard)
  remove(@Req() request: Request, @Param("productId", ParseUUIDPipe) productId: string, @Headers("x-request-id") requestId?: string) {
    return this.carts.remove(readCartToken(request), productId, requestId);
  }

  @Delete() @UseGuards(ClientHeaderGuard)
  clear(@Req() request: Request) {
    return this.carts.clear(readCartToken(request));
  }
}
