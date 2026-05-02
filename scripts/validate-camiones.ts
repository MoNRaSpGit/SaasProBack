import "reflect-metadata";
import * as fs from "node:fs";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { createConnection } from "mysql2/promise";
import { AppModule } from "../src/app.module";

type RegisterPayload = {
  user: { email: string };
  tokens: { accessToken: string };
  tenantContext: {
    tenant: { id: number; name: string };
    modules: string[];
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
  const email = `camiones-${suffix}@saaspro.test`;
  const password = "demo12345";
  const fullName = `Camiones Demo ${suffix}`;
  const tenantName = `Camiones Tenant ${suffix}`;

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
    if (!registerResponse.ok || !registerPayload.tokens?.accessToken) {
      throw new Error(`Register failed: ${JSON.stringify(registerPayload)}`);
    }

    if (!registerPayload.tenantContext?.tenant.id) {
      throw new Error(`Register returned no tenant context: ${JSON.stringify(registerPayload)}`);
    }

    const connection = await createConnection({ uri: process.env.DATABASE_URL });
    await connection.query(
      `INSERT INTO saas_tenant_modules (tenant_id, module_key, enabled)
       VALUES (?, 'camiones', 1)
       ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)`,
      [registerPayload.tenantContext.tenant.id]
    );
    await connection.end();

    const accessToken = registerPayload.tokens.accessToken;

    const createClientResponse = await fetch(`${baseUrl}/camiones/clients`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        name: `Cliente Camiones ${suffix}`,
        phone: "099123456",
        notes: "cliente de prueba"
      })
    });
    const createClientPayload = await readJson(createClientResponse);
    if (!createClientResponse.ok || !createClientPayload.item?.id) {
      throw new Error(`Create client failed: ${JSON.stringify(createClientPayload)}`);
    }

    const duplicateClientResponse = await fetch(`${baseUrl}/camiones/clients`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        name: `Cliente Camiones ${suffix}`,
        phone: "099000111"
      })
    });
    const duplicateClientPayload = await readJson(duplicateClientResponse);
    if (!duplicateClientResponse.ok || duplicateClientPayload.item?.id !== createClientPayload.item.id) {
      throw new Error(`Duplicate client handling failed: ${JSON.stringify(duplicateClientPayload)}`);
    }
    if (duplicateClientPayload.item?.phone !== "099000111") {
      throw new Error(`Duplicate client phone merge failed: ${JSON.stringify(duplicateClientPayload)}`);
    }

    const listClientsResponse = await fetch(`${baseUrl}/camiones/clients?limit=10`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    const listClientsPayload = await readJson(listClientsResponse);
    if (!listClientsResponse.ok) {
      throw new Error(`List clients failed: ${JSON.stringify(listClientsPayload)}`);
    }

    const createPlaceResponse = await fetch(`${baseUrl}/camiones/places`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        name: `Lugar ${suffix}`,
        notes: "lugar de prueba"
      })
    });
    const createPlacePayload = await readJson(createPlaceResponse);
    if (!createPlaceResponse.ok || !createPlacePayload.item?.id) {
      throw new Error(`Create place failed: ${JSON.stringify(createPlacePayload)}`);
    }

    const updatePlaceResponse = await fetch(`${baseUrl}/camiones/places/${createPlacePayload.item.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        name: `Lugar Editado ${suffix}`
      })
    });
    const updatePlacePayload = await readJson(updatePlaceResponse);
    if (!updatePlaceResponse.ok || updatePlacePayload.item?.name !== `Lugar Editado ${suffix}`) {
      throw new Error(`Update place failed: ${JSON.stringify(updatePlacePayload)}`);
    }

    const createTripResponse = await fetch(`${baseUrl}/camiones/trips`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        clientId: createClientPayload.item.id,
        placeId: createPlacePayload.item.id,
        tripDate: "2026-05-02",
        kilometers: 512.5,
        notes: "viaje de prueba"
      })
    });
    const createTripPayload = await readJson(createTripResponse);
    if (!createTripResponse.ok || !createTripPayload.trip?.id) {
      throw new Error(`Create trip failed: ${JSON.stringify(createTripPayload)}`);
    }

    const listTripsResponse = await fetch(`${baseUrl}/camiones/trips?limit=10`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    const listTripsPayload = await readJson(listTripsResponse);
    if (!listTripsResponse.ok) {
      throw new Error(`List trips failed: ${JSON.stringify(listTripsPayload)}`);
    }

    const markPaidResponse = await fetch(`${baseUrl}/camiones/trips/${createTripPayload.trip.id}/pay`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    const markPaidPayload = await readJson(markPaidResponse);
    if (!markPaidResponse.ok) {
      throw new Error(`Mark paid failed: ${JSON.stringify(markPaidPayload)}`);
    }

    const listPaidTripsResponse = await fetch(`${baseUrl}/camiones/trips?status=paid&limit=10`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    const listPaidTripsPayload = await readJson(listPaidTripsResponse);
    if (!listPaidTripsResponse.ok) {
      throw new Error(`List paid trips failed: ${JSON.stringify(listPaidTripsPayload)}`);
    }

    const archivePlaceResponse = await fetch(`${baseUrl}/camiones/places/${createPlacePayload.item.id}/archive`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    const archivePlacePayload = await readJson(archivePlaceResponse);
    if (!archivePlaceResponse.ok || archivePlacePayload.ok !== true) {
      throw new Error(`Archive place failed: ${JSON.stringify(archivePlacePayload)}`);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          register: {
            email: registerPayload.user.email,
            tenant: registerPayload.tenantContext?.tenant.name,
            modules: registerPayload.tenantContext?.modules || []
          },
          createdClient: createClientPayload.item,
          duplicateClient: duplicateClientPayload.item,
          createdPlace: createPlacePayload.item,
          updatedPlace: updatePlacePayload.item,
          listedClientsCount: listClientsPayload.meta?.count,
          createdTrip: createTripPayload.trip,
          listedTripsCount: listTripsPayload.meta?.count,
          paidTrip: markPaidPayload.trip,
          archivedPlace: archivePlacePayload.ok,
          listedPaidTripsCount: listPaidTripsPayload.meta?.count,
          paidTrips: listPaidTripsPayload.items
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
