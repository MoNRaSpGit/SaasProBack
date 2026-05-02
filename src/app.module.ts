import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./modules/auth/auth.module";
import { CamionesModule } from "./modules/camiones/camiones.module";
import { PosModule } from "./modules/pos/pos.module";
import { DatabaseModule } from "./shared/database/database.module";
import { HealthController } from "./shared/health/health.controller";
import { AuthRateLimitMiddleware } from "./shared/http/auth-rate-limit.middleware";
import { RequestLoggingMiddleware } from "./shared/http/request-logging.middleware";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, AuthModule, PosModule, CamionesModule],
  controllers: [HealthController],
  providers: []
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggingMiddleware).forRoutes("*");
    consumer.apply(AuthRateLimitMiddleware).forRoutes("auth");
  }
}
