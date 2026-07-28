import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from "@nestjs/common";
import { Request, Response } from "express";
import { HttpRequestContext } from "./request-context";

type ContextAwareRequest = Request & HttpRequestContext;

// body-parser (express) tira errores planos con .status/.statusCode (via
// http-errors), no HttpException de Nest - los reconocemos igual para no
// mostrarlos como un generico "error del servidor" (ej: payload demasiado
// grande al guardar un workspace grande).
function resolveHttpStatus(exception: unknown): number {
  if (exception instanceof HttpException) {
    return exception.getStatus();
  }

  const candidate = exception as { status?: unknown; statusCode?: unknown } | null;
  const rawStatus = candidate?.status ?? candidate?.statusCode;

  if (typeof rawStatus === "number" && rawStatus >= 400 && rawStatus < 600) {
    return rawStatus;
  }

  return HttpStatus.INTERNAL_SERVER_ERROR;
}

function buildErrorMessage(exception: unknown, status: number) {
  if (exception instanceof HttpException) {
    const response = exception.getResponse();

    if (typeof response === "string") {
      return response;
    }

    if (response && typeof response === "object" && "message" in response) {
      return response.message;
    }
  }

  if (status === HttpStatus.PAYLOAD_TOO_LARGE) {
    return "Los datos que intentaste guardar son demasiado grandes para procesarlos. Contacta soporte.";
  }

  if (exception instanceof Error) {
    return exception.message;
  }

  return "Internal server error";
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<ContextAwareRequest>();

    const status = resolveHttpStatus(exception);
    const message = buildErrorMessage(exception, status);
    const currentUser = request.currentUser;

    console.error(
      JSON.stringify({
        level: "error",
        timestamp: new Date().toISOString(),
        context: "http-exception",
        requestId: request.requestId || null,
        method: request.method,
        path: request.originalUrl || request.url,
        statusCode: status,
        message,
        tenantId: currentUser?.tenantId || null,
        tenantSlug: currentUser?.tenantSlug || null,
        userId: currentUser?.userId || null,
        membershipRole: currentUser?.membershipRole || null,
        stack: exception instanceof Error ? exception.stack : undefined
      })
    );

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.originalUrl || request.url,
      requestId: request.requestId || null
    });
  }
}
