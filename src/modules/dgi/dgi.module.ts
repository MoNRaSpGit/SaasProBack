import { Module } from "@nestjs/common";
import { DgiController } from "./dgi.controller";
import { DgiService } from "./dgi.service";

@Module({
  controllers: [DgiController],
  providers: [DgiService]
})
export class DgiModule {}
