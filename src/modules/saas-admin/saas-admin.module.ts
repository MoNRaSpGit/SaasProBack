import { Module } from "@nestjs/common";
import { SaasAdminAuthGuard } from "./saas-admin-auth.guard";
import { SaasAdminController } from "./saas-admin.controller";
import { SaasAdminService } from "./saas-admin.service";

@Module({
  controllers: [SaasAdminController],
  providers: [SaasAdminService, SaasAdminAuthGuard]
})
export class SaasAdminModule {}
