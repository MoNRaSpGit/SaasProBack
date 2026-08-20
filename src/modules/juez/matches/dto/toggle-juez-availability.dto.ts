import { IsString, MinLength } from "class-validator";

export class ToggleJuezAvailabilityDto {
  @IsString()
  @MinLength(1)
  refereeId!: string;
}
