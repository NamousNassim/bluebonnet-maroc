import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { ClientHeaderGuard } from "../common/client-header.guard";
import { readCartToken } from "../cart/cart-cookie";
import { CheckoutService } from "./checkout.service";

@Controller("v1/checkout")
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post() @UseGuards(ClientHeaderGuard)
  start(@Req() request: Request, @Body() body: unknown) {
    return this.checkout.start(readCartToken(request), body);
  }

  @Post(":id/confirm") @UseGuards(ClientHeaderGuard)
  confirm(@Req() request: Request, @Param("id") id: string, @Headers("x-request-id") requestId?: string) {
    return this.checkout.confirm(readCartToken(request), id, requestId);
  }

  @Get(":id")
  get(@Req() request: Request, @Param("id") id: string) {
    return this.checkout.get(readCartToken(request), id);
  }
}
