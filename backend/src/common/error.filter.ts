import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Request, Response } from "express";
import { ZodError } from "zod";
import { StorefrontError } from "./storefront-error";

/** Every error leaves the API as { code, message[, fields] }; nothing internal is exposed. */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger("Errors");

  catch(error: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const requestId = String(request.headers["x-request-id"] ?? "");
    if (error instanceof StorefrontError) {
      response.status(error.status).json({ code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}) });
      return;
    }
    if (error instanceof ZodError) {
      const fields: Record<string, string> = {};
      for (const issue of error.issues) fields[issue.path.join(".")] ??= issue.message;
      response.status(HttpStatus.BAD_REQUEST).json({ code: "VALIDATION_FAILED", message: "Vérifiez les informations saisies.", fields });
      return;
    }
    if (error instanceof HttpException && error.getStatus() < 500) {
      const status = error.getStatus();
      response.status(status).json({ code: status === 404 ? "NOT_FOUND" : "REQUEST_REJECTED", message: status === 404 ? "Page introuvable." : "La requête n’a pas pu être traitée." });
      return;
    }
    this.logger.error(`Unhandled error requestId=${requestId} path=${request.path}: ${error instanceof Error ? error.stack : String(error)}`);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ code: "INTERNAL_ERROR", message: "Service temporairement indisponible. Veuillez réessayer." });
  }
}
