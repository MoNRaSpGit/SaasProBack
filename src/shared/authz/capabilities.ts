export type TenantMembershipRole = "admin" | "operario" | "staff";

export type TenantCapability =
  | "neon.shell.read"
  | "neon.accounts.read"
  | "neon.accounts.write"
  | "neon.clients.read"
  | "neon.clients.write"
  | "neon.activities.read"
  | "neon.activities.write"
  | "neon.categories.read"
  | "neon.categories.write"
  | "neon.expenses.read"
  | "neon.expenses.write"
  | "neon.journal.read"
  | "neon.journal.write"
  | "camiones.clients.read"
  | "camiones.clients.write"
  | "camiones.places.read"
  | "camiones.places.write"
  | "camiones.trips.read"
  | "camiones.trips.write"
  | "camiones.trips.pay";

const ALL_CAPABILITIES: TenantCapability[] = [
  "neon.shell.read",
  "neon.accounts.read",
  "neon.accounts.write",
  "neon.clients.read",
  "neon.clients.write",
  "neon.activities.read",
  "neon.activities.write",
  "neon.categories.read",
  "neon.categories.write",
  "neon.expenses.read",
  "neon.expenses.write",
  "neon.journal.read",
  "neon.journal.write",
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
    "neon.accounts.read",
    "neon.journal.read",
    "neon.clients.read",
    "neon.activities.read",
    "neon.categories.read",
    "neon.expenses.read",
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
