import type { Request, Response } from "express";
import { AppConfig } from "../config/app-config";

export const CART_COOKIE = "bb_cart";

export const readCartToken = (request: Request): string | undefined => {
  const value = request.cookies?.[CART_COOKIE];
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : undefined;
};

/** httpOnly, SameSite=Lax: invisible to scripts and not sent on cross-site POSTs. */
export function writeCartToken(response: Response, token: string, config: AppConfig): void {
  response.cookie(CART_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: config.CART_COOKIE_SECURE, path: "/", maxAge: 30 * 86_400_000,
  });
}
