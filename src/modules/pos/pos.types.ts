export type PosRequestUser = {
  userId: number;
  email: string;
  tenantId: number;
  tenantName: string;
  tenantSlug: string;
  membershipRole: string;
  modules: string[];
};
