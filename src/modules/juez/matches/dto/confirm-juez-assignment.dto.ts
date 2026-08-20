import { IsString, MinLength } from "class-validator";

export class ConfirmJuezAssignmentDto {
  @IsString()
  @MinLength(1)
  principalRefereeId!: string;

  @IsString()
  @MinLength(1)
  secondaryRefereeId!: string;

  @IsString()
  @MinLength(1)
  scorerRefereeId!: string;
}
