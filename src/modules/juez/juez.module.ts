import { Module } from "@nestjs/common";
import { JuezAuthModule } from "./auth/juez-auth.module";

@Module({
  imports: [JuezAuthModule]
})
export class JuezModule {}
