import { ArrayNotEmpty, IsArray, IsIn } from "class-validator";
import { JuezRole } from "./register-juez.dto";

const JUEZ_ROLES = ["principal", "secundario", "planillero"] as const;

export class UpdateJuezAccountRolesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(JUEZ_ROLES, { each: true })
  roles!: JuezRole[];
}
