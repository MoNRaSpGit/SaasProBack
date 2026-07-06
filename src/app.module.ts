import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AlamcenModule } from "./modules/alamcen/alamcen.module";
import { AuthModule } from "./modules/auth/auth.module";
import { AgroModule } from "./modules/agro/agro.module";
import { CamionesModule } from "./modules/camiones/camiones.module";
import { NeonModule } from "./modules/neon/neon.module";
import { ScrumModule } from "./modules/scrum/scrum.module";
import { SaasAdminModule } from "./modules/saas-admin/saas-admin.module";
import { AuthzModule } from "./shared/authz/authz.module";
import { DatabaseModule } from "./shared/database/database.module";
import { HealthController } from "./shared/health/health.controller";
import { AuthRateLimitMiddleware } from "./shared/http/auth-rate-limit.middleware";
import { RequestLoggingMiddleware } from "./shared/http/request-logging.middleware";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthzModule,
    DatabaseModule,
    AuthModule,
    SaasAdminModule,
    AlamcenModule,
    CamionesModule,
    NeonModule,
    AgroModule,
    ScrumModule
  ],
  controllers: [HealthController],
  providers: []
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggingMiddleware).forRoutes("*");
    consumer.apply(AuthRateLimitMiddleware).forRoutes("auth");
  }
}
