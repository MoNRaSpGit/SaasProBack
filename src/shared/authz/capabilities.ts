export type TenantMembershipRole = "admin" | "operario" | "staff";

export type TenantCapability =
  | "neon.shell.read"
  | "neon.clients.read"
  | "neon.clients.write"
  | "neon.activities.read"
  | "neon.activities.write"
  | "camiones.clients.read"
  | "camiones.clients.write"
  | "camiones.places.read"
  | "camiones.places.write"
  | "camiones.trips.read"
  | "camiones.trips.write"
  | "camiones.trips.pay";

const ALL_CAPABILITIES: TenantCapability[] = [
  "neon.shell.read",
  "neon.clients.read",
  "neon.clients.write",
  "neon.activities.read",
  "neon.activities.write",
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
    "neon.shell.read",
    "neon.clients.read",
    "neon.activities.read",
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
