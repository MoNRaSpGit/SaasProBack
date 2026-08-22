export type TenantMembershipRole = "admin" | "operario" | "staff";

export type TenantCapability =
  | "agro.shell.read"
  | "agro.discovery.read"
  | "agro.discovery.write"
  | "camiones.clients.read"
  | "camiones.clients.write"
  | "camiones.places.read"
  | "camiones.places.write"
  | "camiones.trips.read"
  | "camiones.trips.write"
  | "camiones.trips.pay";

const ALL_CAPABILITIES: TenantCapability[] = [
  "agro.shell.read",
  "agro.discovery.read",
  "agro.discovery.write",
  "camiones.clients.read",
  "camiones.clients.write",
  "camiones.places.read",
  "camiones.places.write",
  "camiones.trips.read",
  "camiones.trips.write",
  "camiones.trips.pay"
];

const ROLE_CAPABILITIES: Record<TenantMembershipRole, TenantCapability[]> = {
  staff: ALL_CAPABILITIES,
  admin: ALL_CAPABILITIES,
  operario: [
    "agro.shell.read",
    "agro.discovery.read",
    "agro.discovery.write",
    "camiones.clients.read",
    "camiones.places.read",
    "camiones.trips.read",
    "camiones.trips.write"
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
