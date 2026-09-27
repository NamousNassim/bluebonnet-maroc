import { HttpStatus } from "@nestjs/common";

/**
 * A customer-safe error: a stable code for the frontend and a French message fit for display.
 * Internal details (StartEntreprise codes, stack traces) are logged, never returned.
 */
export class StorefrontError extends Error {
  constructor(
    readonly status: HttpStatus,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }

  static notFound(code: string, message: string) { return new StorefrontError(HttpStatus.NOT_FOUND, code, message); }
  static conflict(code: string, message: string) { return new StorefrontError(HttpStatus.CONFLICT, code, message); }
  static badRequest(code: string, message: string, fields?: Record<string, string>) {
    return new StorefrontError(HttpStatus.BAD_REQUEST, code, message, fields);
  }
  static unavailable(code: string, message: string) { return new StorefrontError(HttpStatus.SERVICE_UNAVAILABLE, code, message); }
}
