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

    const statusResponse = await fetch(`${baseUrl}/neon/status`, {
      headers: {
        Authorization: `Bearer ${registerPayload.tokens.accessToken}`
      }
    });
    const statusPayload = await readJson(statusResponse);
    if (!statusResponse.ok) {
      throw new Error(`Neon status failed: ${JSON.stringify(statusPayload)}`);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          tenant: registerPayload.tenantContext.tenant,
          status: statusPayload
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
