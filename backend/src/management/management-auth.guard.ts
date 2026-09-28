import { createHash, timingSafeEqual } from "node:crypto";
import { CanActivate, ExecutionContext, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { StorefrontError } from "../common/storefront-error";
import { APP_CONFIG, AppConfig } from "../config/app-config";

@Injectable()
export class ManagementAuthGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.config.BLUEBONNET_MANAGEMENT_ENABLED) {
      throw new StorefrontError(HttpStatus.SERVICE_UNAVAILABLE, "MANAGEMENT_DISABLED", "Management API is disabled.");
    }
    const request = context.switchToHttp().getRequest<Request>();
    const credentials = basicCredentials(request.headers.authorization);
    if (!credentials) throw new StorefrontError(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Machine credentials are required.");
    if (!safeEqual(credentials.clientId, this.config.BLUEBONNET_MANAGEMENT_CLIENT_ID ?? "")) {
      throw new StorefrontError(HttpStatus.FORBIDDEN, "FORBIDDEN", "Management client is not allowed.");
    }
    if (!safeEqual(credentials.secret, this.config.BLUEBONNET_MANAGEMENT_CLIENT_SECRET ?? "")) {
      throw new StorefrontError(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Machine credentials are invalid.");
    }
    return true;
  }
}

function basicCredentials(header?: string): { clientId: string; secret: string } | undefined {
  if (!header?.startsWith("Basic ")) return undefined;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 1) return undefined;
    return { clientId: decoded.slice(0, separator), secret: decoded.slice(separator + 1) };
  } catch { return undefined; }
}

function safeEqual(left: string, right: string): boolean {
  return timingSafeEqual(createHash("sha256").update(left).digest(), createHash("sha256").update(right).digest());
}
