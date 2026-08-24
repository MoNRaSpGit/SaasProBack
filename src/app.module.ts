import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { AuthModule } from "./modules/auth/auth.module";
import { AgroModule } from "./modules/agro/agro.module";
import { CamisetasModule } from "./modules/camisetas/camisetas.module";
import { CarnetModule } from "./modules/carnet/carnet.module";
import { CamionesModule } from "./modules/camiones/camiones.module";
import { DgiModule } from "./modules/dgi/dgi.module";
import { JokerModule } from "./modules/joker/joker.module";
import { JuezModule } from "./modules/juez/juez.module";
import { OriolModule } from "./modules/oriol/oriol.module";
import { PilotoModule } from "./modules/piloto/piloto.module";
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
    ScheduleModule.forRoot(),
    AuthzModule,
    DatabaseModule,
    AuthModule,
    SaasAdminModule,
    CamionesModule,
    CamisetasModule,
    DgiModule,
    AgroModule,
    ScrumModule,
    CarnetModule,
    JuezModule,
    PilotoModule,
    JokerModule,
    OriolModule
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
