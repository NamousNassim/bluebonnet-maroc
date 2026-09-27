import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { StorefrontError } from "./storefront-error";

export const CLIENT_HEADER = "x-bluebonnet-client";

/**
 * CSRF defence for cookie-authenticated mutations: a custom header cannot be sent cross-site without
 * a CORS preflight, which this API never grants to foreign origins (and the cookie is SameSite=Lax).
 */
@Injectable()
export class ClientHeaderGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.headers[CLIENT_HEADER] !== "web") {
      throw StorefrontError.badRequest("CLIENT_HEADER_REQUIRED", "Requête refusée.");
    }
    return true;
  }
}
