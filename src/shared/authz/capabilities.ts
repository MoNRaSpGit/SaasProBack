export type TenantMembershipRole = "admin" | "operario" | "staff" | "camionero";

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
  | "camiones.trips.pay"
  // Camioneros (14/11/2026): solo cargan viajes sin valor y ven los suyos.
  | "camiones.trips.submit";

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
  "camiones.trips.pay",
  "camiones.trips.submit"
];

const ROLE_CAPABILITIES: Record<TenantMembershipRole, TenantCapability[]> = {
  staff: ALL_CAPABILITIES,
  admin: ALL_CAPABILITIES,
  // Camionero: ve clientes y lugares, carga viajes (sin km ni valor) y ve los
  // suyos. NO lee ni edita el resto, ni cobra.
  camionero: ["camiones.clients.read", "camiones.places.read", "camiones.trips.submit"],
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
  return value === "admin" || value === "operario" || value === "staff" || value === "camionero";
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
