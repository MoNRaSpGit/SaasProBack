import { IsString, MinLength } from "class-validator";

export class CarnetAdminLoginDto {
  @IsString()
  @MinLength(1)
  pin!: string;
}
