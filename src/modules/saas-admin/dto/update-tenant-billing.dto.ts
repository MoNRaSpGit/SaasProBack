import { IsEnum, IsOptional, IsString, Matches, MaxLength } from "class-validator";
import { TenantBillingStatus } from "../saas-admin.types";

export class UpdateTenantBillingDto {
  @IsEnum(["active", "grace_period", "pending_manual_block", "blocked"] as const)
  billingStatus!: TenantBillingStatus;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  paidUntil?: string | null;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  graceUntil?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  blockedReason?: string | null;
}
