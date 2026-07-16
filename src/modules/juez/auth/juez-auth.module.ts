import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "../../../shared/database/database.module";
import { MailService } from "../../../shared/mail/mail.service";
import { JuezAuthController } from "./juez-auth.controller";
import { JuezAuthService } from "./juez-auth.service";

@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [JuezAuthController],
  providers: [JuezAuthService, MailService]
})
export class JuezAuthModule {}
