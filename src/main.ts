import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import * as compression from "compression";
import { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";
import { getAllowedCorsOrigins, isCorsOriginAllowed } from "./shared/http/cors";
import { GlobalExceptionFilter } from "./shared/http/global-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const allowedOrigins = getAllowedCorsOrigins();

  // El default de Express (100kb) se queda corto para modulos que guardan
  // un blob JSON grande de una (ej: el workspace completo de agro).
  app.useBodyParser("json", { limit: "10mb" });
  app.useBodyParser("urlencoded", { limit: "10mb", extended: true });

  app.use(compression());

  app.use((request: Request, response: Response, next: NextFunction) => {
    const originHeader = request.headers.origin;
    const origin = typeof originHeader === "string" ? originHeader : undefined;

    if (isCorsOriginAllowed(origin, allowedOrigins)) {
      response.setHeader("Timing-Allow-Origin", origin || "*");
    }

    next();
  });

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => {
      if (isCorsOriginAllowed(origin, allowedOrigins)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"), false);
    },
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id"],
    credentials: false,
    optionsSuccessStatus: 204,
    maxAge: 600
  });
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  );
  app.useGlobalFilters(new GlobalExceptionFilter());

  const rawPort = process.env.PORT;
  const parsedPort = rawPort ? Number(rawPort) : 3000;
  const port = Number.isFinite(parsedPort) && parsedPort > 0 && parsedPort < 65536 ? parsedPort : 3000;
  await app.listen(port);
}

void bootstrap();
