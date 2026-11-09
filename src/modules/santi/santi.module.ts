import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/database/database.module";
import { SantiController } from "./santi.controller";
import { SantiService } from "./santi.service";

@Module({
  imports: [DatabaseModule],
  controllers: [SantiController],
  providers: [SantiService]
})
export class SantiModule {}
