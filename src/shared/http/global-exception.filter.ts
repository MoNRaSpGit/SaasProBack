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

function buildErrorMessage(exception: unknown) {
  if (exception instanceof HttpException) {
    const response = exception.getResponse();

    if (typeof response === "string") {
      return response;
    }

    if (response && typeof response === "object" && "message" in response) {
      return response.message;
    }
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

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = buildErrorMessage(exception);
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
