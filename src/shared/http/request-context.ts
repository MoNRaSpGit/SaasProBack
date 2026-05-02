export type RequestContextUser = {
  userId: number;
  email: string;
  tenantId: number;
  tenantName: string;
  tenantSlug: string;
  membershipRole: string;
  modules?: string[];
};

export type HttpRequestContext = {
  requestId?: string;
  currentUser?: RequestContextUser;
};
