import "reflect-metadata";
import * as fs from "node:fs";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { createConnection } from "mysql2/promise";
import { AppModule } from "../src/app.module";

type RegisterPayload = {
  user: { id: number; email: string };
  tokens: { accessToken: string };
  tenantContext: {
    tenant: { id: number; name: string };
  } | null;
};

function buildUniqueSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function loadEnvFile() {
  const envText = fs.readFileSync(".env", "utf8");

  for (const line of envText.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

async function main() {
  loadEnvFile();

  const suffix = buildUniqueSuffix();
  const email = `rbac-${suffix}@saaspro.test`;
  const password = "demo12345";
  const fullName = `RBAC Demo ${suffix}`;
  const tenantName = `RBAC Tenant ${suffix}`;

  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  );
  await app.listen(0);

  try {
    const server = app.getHttpServer() as { address(): { port: number } };
    const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;

    const registerResponse = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, fullName, tenantName })
    });
    const registerPayload = (await readJson(registerResponse)) as RegisterPayload;
    if (!registerResponse.ok || !registerPayload.tokens?.accessToken || !registerPayload.tenantContext?.tenant.id) {
      throw new Error(`Register failed: ${JSON.stringify(registerPayload)}`);
    }

    const connection = await createConnection({ uri: process.env.DATABASE_URL });
    await connection.query(
      `INSERT INTO saas_tenant_modules (tenant_id, module_key, enabled)
       VALUES (?, 'camiones', 1)
       ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)`,
      [registerPayload.tenantContext.tenant.id]
    );
    await connection.query(
      `UPDATE saas_tenant_memberships
       SET role = 'operario'
       WHERE tenant_id = ? AND user_id = ?`,
      [registerPayload.tenantContext.tenant.id, registerPayload.user.id]
    );
    await connection.end();

    const accessToken = registerPayload.tokens.accessToken;

    const createClientResponse = await fetch(`${baseUrl}/camiones/clients`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name: `Cliente RBAC ${suffix}` })
    });
    const createClientPayload = await readJson(createClientResponse);
    if (createClientResponse.status !== 403) {
      throw new Error(`Camiones client create should be forbidden: ${JSON.stringify(createClientPayload)}`);
    }

    const adminConnection = await createConnection({ uri: process.env.DATABASE_URL });
    const [clientResult] = await adminConnection.query(
      `INSERT INTO saas_camiones_clients (tenant_id, branch_id, name, phone, notes, is_active)
       VALUES (?, NULL, ?, NULL, NULL, 1)`,
      [registerPayload.tenantContext.tenant.id, `Cliente RBAC ${suffix}`]
    );
    await adminConnection.end();

    const clientId = Number((clientResult as { insertId?: number }).insertId);
    if (!clientId) {
      throw new Error("Unable to seed camiones client for RBAC validation");
    }

    const createTripResponse = await fetch(`${baseUrl}/camiones/trips`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        clientId,
        placeName: `Destino ${suffix}`,
        kilometers: 12,
        tripDate: "2026-05-05"
      })
    });
    const createTripPayload = await readJson(createTripResponse);
    if (!createTripResponse.ok) {
      throw new Error(`Camiones trip create should be allowed: ${JSON.stringify(createTripPayload)}`);
    }

    const payTripResponse = await fetch(`${baseUrl}/camiones/trips/${createTripPayload.trip.id}/pay`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    const payTripPayload = await readJson(payTripResponse);
    if (payTripResponse.status !== 403) {
      throw new Error(`Camiones trip pay should be forbidden: ${JSON.stringify(payTripPayload)}`);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          role: "operario",
          clientCreateStatusCode: createClientResponse.status,
          tripCreateStatusCode: createTripResponse.status,
          tripPayStatusCode: payTripResponse.status
        },
        null,
        2
      )
    );
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
