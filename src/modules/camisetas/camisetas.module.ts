import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/database/database.module";
import { CamisetasAdminGuard } from "./camisetas-admin.guard";
import { CamisetasController } from "./camisetas.controller";
import { CamisetasService } from "./camisetas.service";

@Module({
  imports: [DatabaseModule],
  controllers: [CamisetasController],
  providers: [CamisetasService, CamisetasAdminGuard]
})
export class CamisetasModule {}
