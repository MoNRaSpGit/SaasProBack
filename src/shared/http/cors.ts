const OFFICIAL_FRONTEND_ORIGINS = ["https://monraspgit.github.io"] as const;

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

  return [...OFFICIAL_FRONTEND_ORIGINS];
}

export function isCorsOriginAllowed(origin: string | undefined, allowedOrigins: readonly string[]) {
  if (!origin) {
    return true;
  }

  try {
    const parsedOrigin = new URL(origin);
    const isLocalDevOrigin =
      isPrivateNetworkHostname(parsedOrigin.hostname) &&
      ["http:", "https:"].includes(parsedOrigin.protocol);

    if (isLocalDevOrigin) {
      return true;
    }
  } catch {
    return false;
  }

  return allowedOrigins.includes(origin);
}
