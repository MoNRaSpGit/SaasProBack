import { IsIn } from "class-validator";

export class RecordJuezLoginDto {
  @IsIn(["admin", "usuario"])
  actor!: "admin" | "usuario";
}
