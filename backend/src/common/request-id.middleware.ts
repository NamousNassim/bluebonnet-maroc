import { randomUUID } from "node:crypto";
import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

/** Correlates a storefront request with its StartEntreprise calls and logs. */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const incoming = request.headers["x-request-id"];
    const id = typeof incoming === "string" && /^[A-Za-z0-9-]{8,64}$/.test(incoming) ? incoming : randomUUID();
    request.headers["x-request-id"] = id;
    response.setHeader("X-Request-Id", id);
    next();
  }
}
