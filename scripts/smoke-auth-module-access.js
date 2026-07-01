const DEFAULT_API_BASE_URL = process.env.SMOKE_API_BASE_URL || "https://saasproback.onrender.com";
const DEFAULT_EMAIL = process.env.SMOKE_EMAIL || "camiones.demo@saaspro.com";
const DEFAULT_PASSWORD = process.env.SMOKE_PASSWORD || "camiones123";
const DEFAULT_MODULE = process.env.SMOKE_MODULE || "camiones";

async function readJson(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const rawMessage = payload && typeof payload === "object" ? payload.message : null;
    const message = Array.isArray(rawMessage)
      ? rawMessage.join(", ")
      : rawMessage || `HTTP ${response.status}`;

    throw new Error(message);
  }

  return payload;
}

async function main() {
  const loginResponse = await fetch(`${DEFAULT_API_BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: DEFAULT_EMAIL,
      password: DEFAULT_PASSWORD
    })
  });

  const loginPayload = await readJson(loginResponse);
  const accessToken = loginPayload?.tokens?.accessToken;
  const refreshToken = loginPayload?.tokens?.refreshToken;
  const modules = loginPayload?.tenantContext?.modules || [];

  if (!accessToken || !refreshToken) {
    throw new Error("Login sin tokens validos");
  }

  if (!modules.includes(DEFAULT_MODULE)) {
    throw new Error(`El tenant autenticado no tiene habilitado el modulo ${DEFAULT_MODULE}`);
  }

  const refreshResponse = await fetch(`${DEFAULT_API_BASE_URL}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken })
  });

  const refreshPayload = await readJson(refreshResponse);
  const refreshedAccessToken = refreshPayload?.tokens?.accessToken;

  if (!refreshedAccessToken) {
    throw new Error("Refresh sin access token nuevo");
  }

  const moduleResponse = await fetch(`${DEFAULT_API_BASE_URL}/api/v1/camiones/clients?limit=1`, {
    headers: {
      Authorization: `Bearer ${refreshedAccessToken}`
    }
  });

  const modulePayload = await readJson(moduleResponse);

  const result = {
    ok: true,
    apiBaseUrl: DEFAULT_API_BASE_URL,
    email: DEFAULT_EMAIL,
    module: DEFAULT_MODULE,
    tenant: loginPayload?.tenantContext?.tenant?.slug || null,
    modules,
    clientsCount: Array.isArray(modulePayload?.items) ? modulePayload.items.length : 0
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        apiBaseUrl: DEFAULT_API_BASE_URL,
        email: DEFAULT_EMAIL,
        module: DEFAULT_MODULE,
        error: error instanceof Error ? error.message : String(error)
      },
      null,
      2
    )
  );
  process.exit(1);
});
