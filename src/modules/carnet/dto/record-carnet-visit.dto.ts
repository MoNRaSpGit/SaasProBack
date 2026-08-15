import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class RecordCarnetVisitDto {
  @IsString()
  @MaxLength(64)
  visitorId!: string;

  @IsOptional()
  @IsIn(["usuario", "admin"])
  role?: "usuario" | "admin";
}
