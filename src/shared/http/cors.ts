// Dominio propio de frontend-qq (18/09/2026): se aceptan las dos variantes
// (con y sin www) porque GitHub Pages redirige de una a la otra segun como
// este el DNS, y el navegador manda como Origin la que el usuario termine
// viendo en la barra -- si falta una, el catalogo no carga por CORS.
const OFFICIAL_FRONTEND_ORIGINS = [
  "https://monraspgit.github.io",
  "https://qqdigital.net",
  "https://www.qqdigital.net"
] as const;
const LOCAL_DEV_FRONTEND_ORIGINS = ["http://localhost:5173", "http://localhost:5174"] as const;

function isPrivateNetworkHostname(hostname: string) {
  if (["localhost", "127.0.0.1"].includes(hostname) || hostname.endsWith(".local")) {
    return true;
  }

  const ipv4Match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!ipv4Match) {
    return false;
  }

  const [, firstOctet, secondOctet] = ipv4Match.map(Number);
  if (firstOctet === 10) {
    return true;
  }

  if (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) {
    return true;
  }

  return firstOctet === 192 && secondOctet === 168;
}

export function getAllowedCorsOrigins() {
  const configuredOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (configuredOrigins.length > 0) {
    return Array.from(new Set(configuredOrigins));
  }

  const environment = (process.env.NODE_ENV || "development").toLowerCase();
  if (environment === "production") {
    return [...OFFICIAL_FRONTEND_ORIGINS];
  }

  return [...OFFICIAL_FRONTEND_ORIGINS, ...LOCAL_DEV_FRONTEND_ORIGINS];
}

export function isCorsOriginAllowed(origin: string | undefined, allowedOrigins: readonly string[]) {
  if (!origin) {
    return true;
  }

  const environment = (process.env.NODE_ENV || "development").toLowerCase();

  try {
    const parsedOrigin = new URL(origin);
    const isLocalDevOrigin =
      isPrivateNetworkHostname(parsedOrigin.hostname) &&
      ["http:", "https:"].includes(parsedOrigin.protocol);

    if (isLocalDevOrigin && environment !== "production") {
      return true;
    }
  } catch {
    return false;
  }

  return allowedOrigins.includes(origin);
}
