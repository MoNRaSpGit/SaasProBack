const LOCAL_DEV_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174"
] as const;

const OFFICIAL_FRONTEND_ORIGINS = ["https://monraspgit.github.io"] as const;

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

  return [...LOCAL_DEV_ORIGINS, ...OFFICIAL_FRONTEND_ORIGINS];
}

export function isCorsOriginAllowed(origin: string | undefined, allowedOrigins: readonly string[]) {
  if (!origin) {
    return true;
  }

  return allowedOrigins.includes(origin);
}
