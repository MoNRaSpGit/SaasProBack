export type TenantMembershipRole = "admin" | "operario" | "staff";

export type TenantCapability =
  | "pos.products.read"
  | "pos.products.write"
  | "pos.sales.read"
  | "pos.sales.write"
  | "pos.payments.read"
  | "pos.payments.write"
  | "pos.dashboard.read"
  | "camiones.clients.read"
  | "camiones.clients.write"
  | "camiones.trips.read"
  | "camiones.trips.write"
  | "camiones.trips.pay"
  | "distribuidora.shell.read"
  | "distribuidora.admin.read";

const ALL_CAPABILITIES: TenantCapability[] = [
  "pos.products.read",
  "pos.products.write",
  "pos.sales.read",
  "pos.sales.write",
  "pos.payments.read",
  "pos.payments.write",
  "pos.dashboard.read",
  "camiones.clients.read",
  "camiones.clients.write",
  "camiones.trips.read",
  "camiones.trips.write",
  "camiones.trips.pay",
  "distribuidora.shell.read",
  "distribuidora.admin.read"
];

const ROLE_CAPABILITIES: Record<TenantMembershipRole, TenantCapability[]> = {
  staff: ALL_CAPABILITIES,
  admin: ALL_CAPABILITIES,
  operario: [
    "pos.products.read",
    "pos.sales.read",
    "pos.sales.write",
    "camiones.clients.read",
    "camiones.trips.read",
    "camiones.trips.write",
    "distribuidora.shell.read"
  ]
};

export function isTenantMembershipRole(value: string): value is TenantMembershipRole {
  return value === "admin" || value === "operario" || value === "staff";
}

export function getCapabilitiesForRole(role: string): TenantCapability[] {
  if (!isTenantMembershipRole(role)) {
    return [];
  }

  return ROLE_CAPABILITIES[role];
}

export function hasCapability(role: string, capability: TenantCapability) {
  return getCapabilitiesForRole(role).includes(capability);
}
