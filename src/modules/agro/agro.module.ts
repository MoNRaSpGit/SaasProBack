import { Module } from "@nestjs/common";
import { AgroAuthGuard } from "./agro-auth.guard";
import { AgroController } from "./agro.controller";
import { AgroService } from "./agro.service";

@Module({
  controllers: [AgroController],
  providers: [AgroService, AgroAuthGuard]
})
export class AgroModule {}
