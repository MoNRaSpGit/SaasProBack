import { Module } from "@nestjs/common";
import { AgroAuthGuard } from "./agro-auth.guard";
import { AgroOwnAuthController } from "./agro-own-auth.controller";
import { AgroOwnAuthService } from "./agro-own-auth.service";
import { AgroController } from "./agro.controller";
import { AgroService } from "./agro.service";

@Module({
  controllers: [AgroOwnAuthController, AgroController],
  providers: [AgroService, AgroOwnAuthService, AgroAuthGuard]
})
export class AgroModule {}
