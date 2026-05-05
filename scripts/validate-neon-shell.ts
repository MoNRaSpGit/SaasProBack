import "reflect-metadata";
import * as fs from "node:fs";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { createConnection } from "mysql2/promise";
import { AppModule } from "../src/app.module";

type RegisterPayload = {
  tokens?: {
    accessToken: string;
  };
  tenantContext?: {
    tenant: {
      id: number;
      name: string;
      slug: string;
    };
  } | null;
  message?: string | string[];
};

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

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

async function main() {
  loadEnvFile();

  const suffix = buildUniqueSuffix();
  const email = `neon-${suffix}@saaspro.test`;
  const password = "demo12345";
  const fullName = `Neon Demo ${suffix}`;
  const tenantName = `Neon Tenant ${suffix}`;

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
       VALUES (?, 'neon', 1)
       ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)`,
      [registerPayload.tenantContext.tenant.id]
    );
    await connection.end();

    const authHeaders = {
      Authorization: `Bearer ${registerPayload.tokens.accessToken}`,
      "Content-Type": "application/json"
    };

    const statusResponse = await fetch(`${baseUrl}/neon/status`, { headers: authHeaders });
    const statusPayload = await readJson(statusResponse);
    if (!statusResponse.ok) {
      throw new Error(`Neon status failed: ${JSON.stringify(statusPayload)}`);
    }

    const createClientResponse = await fetch(`${baseUrl}/neon/clients`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: `Cliente Neon ${suffix}`,
        phone: "099123123",
        notes: "cliente de prueba neon"
      })
    });
    const createClientPayload = await readJson(createClientResponse);
    if (!createClientResponse.ok || !createClientPayload?.item?.id) {
      throw new Error(`Create Neon client failed: ${JSON.stringify(createClientPayload)}`);
    }

    const createActivityResponse = await fetch(`${baseUrl}/neon/activities`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        activityDate: "2026-05-05",
        description: `Pantalla demo ${suffix}`,
        clientId: createClientPayload.item.id,
        activityType: "neon",
        quotedAmount: 2500,
        commercialStatus: "pendiente_de_facturar"
      })
    });
    const createActivityPayload = await readJson(createActivityResponse);
    if (!createActivityResponse.ok || !createActivityPayload?.item?.id) {
      throw new Error(`Create Neon activity failed: ${JSON.stringify(createActivityPayload)}`);
    }

    const listAccountsResponse = await fetch(`${baseUrl}/neon/accounts`, {
      headers: authHeaders
    });
    const listAccountsPayload = await readJson(listAccountsResponse);
    if (!listAccountsResponse.ok || !Array.isArray(listAccountsPayload?.items) || listAccountsPayload.items.length < 2) {
      throw new Error(`List Neon accounts failed: ${JSON.stringify(listAccountsPayload)}`);
    }

    const cashAccount = listAccountsPayload.items.find((item: { accountType?: string }) => item.accountType === "cash");
    if (!cashAccount?.id) {
      throw new Error(`Cash account missing: ${JSON.stringify(listAccountsPayload)}`);
    }

    const createPaymentResponse = await fetch(`${baseUrl}/neon/activities/${createActivityPayload.item.id}/payments`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        accountId: cashAccount.id,
        paymentDate: "2026-05-05",
        paidAmount: 300,
        description: `Pago demo ${suffix}`
      })
    });
    const createPaymentPayload = await readJson(createPaymentResponse);
    if (!createPaymentResponse.ok || !createPaymentPayload?.item?.id) {
      throw new Error(`Create Neon payment failed: ${JSON.stringify(createPaymentPayload)}`);
    }

    const listActivitiesResponse = await fetch(`${baseUrl}/neon/activities?limit=10`, {
      headers: authHeaders
    });
    const listActivitiesPayload = await readJson(listActivitiesResponse);
    if (!listActivitiesResponse.ok || !Array.isArray(listActivitiesPayload?.items)) {
      throw new Error(`List Neon activities failed: ${JSON.stringify(listActivitiesPayload)}`);
    }

    const detailResponse = await fetch(`${baseUrl}/neon/activities/${createActivityPayload.item.id}`, {
      headers: authHeaders
    });
    const detailPayload = await readJson(detailResponse);
    if (!detailResponse.ok || !detailPayload?.item?.id) {
      throw new Error(`Get Neon activity failed: ${JSON.stringify(detailPayload)}`);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          tenant: registerPayload.tenantContext.tenant,
          status: statusPayload,
          client: createClientPayload.item,
          activity: createActivityPayload.item,
          accountsCount: listAccountsPayload.items.length,
          paymentActivity: createPaymentPayload.item,
          listedActivitiesCount: listActivitiesPayload.items.length,
          activityDetail: detailPayload.item
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
