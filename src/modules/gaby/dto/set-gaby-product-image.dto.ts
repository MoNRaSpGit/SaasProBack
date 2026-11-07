import { IsString, MinLength } from "class-validator";

export class SetGabyProductImageDto {
  // data:<mime>;base64,<payload>
  @IsString()
  @MinLength(1)
  dataUri!: string;
}
