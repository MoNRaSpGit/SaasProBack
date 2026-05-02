export type SaasAdminRequestUser = {
  userId: number;
  email: string;
  globalRole: string;
};

export type TenantBillingStatus = "active" | "grace_period" | "pending_manual_block" | "blocked";

export const SAAS_ADMIN_MODULE_KEYS = ["camiones", "distribuidora", "pos"] as const;

export type SaasAdminModuleKey = (typeof SAAS_ADMIN_MODULE_KEYS)[number];
