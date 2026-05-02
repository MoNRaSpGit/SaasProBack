import { Body, Controller, Get, Param, ParseIntPipe, Patch, UseGuards } from "@nestjs/common";
import { CurrentSaasAdminUser } from "./current-saas-admin-user.decorator";
import { UpdateTenantBillingDto } from "./dto/update-tenant-billing.dto";
import { SaasAdminAuthGuard } from "./saas-admin-auth.guard";
import { SaasAdminService } from "./saas-admin.service";
import { SaasAdminRequestUser } from "./saas-admin.types";

@Controller("saas-admin")
@UseGuards(SaasAdminAuthGuard)
export class SaasAdminController {
  constructor(private readonly saasAdminService: SaasAdminService) {}

  @Get("tenants")
  listTenants(@CurrentSaasAdminUser() currentUser: SaasAdminRequestUser) {
    return this.saasAdminService.listTenants();
  }

  @Patch("tenants/:tenantId/billing")
  updateTenantBilling(
    @Param("tenantId", ParseIntPipe) tenantId: number,
    @Body() dto: UpdateTenantBillingDto,
    @CurrentSaasAdminUser() currentUser: SaasAdminRequestUser
  ) {
    return this.saasAdminService.updateTenantBilling(tenantId, dto);
  }
}
