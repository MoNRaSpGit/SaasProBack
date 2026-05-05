import { SAAS_PRODUCT_KEYS, SaasProductKey } from "../../shared/saas/product-catalog";

export type SaasAdminRequestUser = {
  userId: number;
  email: string;
  globalRole: string;
};

export type TenantBillingStatus = "active" | "grace_period" | "pending_manual_block" | "blocked";

export const SAAS_ADMIN_MODULE_KEYS = SAAS_PRODUCT_KEYS;

export type SaasAdminModuleKey = SaasProductKey;
