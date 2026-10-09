import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../../shared/database/database.module";
import { JuezAuditController } from "./juez-audit.controller";
import { JuezAuditService } from "./juez-audit.service";

@Module({
  imports: [DatabaseModule],
  controllers: [JuezAuditController],
  providers: [JuezAuditService],
  exports: [JuezAuditService]
})
export class JuezAuditModule {}
