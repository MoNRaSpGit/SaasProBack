import { ArrayUnique, IsArray, IsIn } from "class-validator";
import { SAAS_ADMIN_MODULE_KEYS, SaasAdminModuleKey } from "../saas-admin.types";

export class UpdateTenantModulesDto {
  @IsArray()
  @ArrayUnique()
  @IsIn(SAAS_ADMIN_MODULE_KEYS, { each: true })
  enabledModules!: SaasAdminModuleKey[];
}
