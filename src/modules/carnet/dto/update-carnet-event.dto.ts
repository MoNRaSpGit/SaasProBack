import { IsBoolean } from "class-validator";

export class UpdateCarnetEventDto {
  @IsBoolean()
  isClosed!: boolean;
}
