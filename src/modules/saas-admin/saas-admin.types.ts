export type SaasAdminRequestUser = {
  userId: number;
  email: string;
  globalRole: string;
};

export type TenantBillingStatus = "active" | "grace_period" | "pending_manual_block" | "blocked";
